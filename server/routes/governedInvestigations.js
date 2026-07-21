const router = require('express').Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { normalizeTransaction, scoreTypologies, assertTransition, evaluateAlerts } = require('../domain/investigationPolicy');
const tenant = (u) => u.tenant_id;
const requireReviewer = (req, res, next) => ['reviewer','admin'].includes(req.user.role)
  ? next() : res.status(403).json({ error: 'Reviewer role required' });
router.use(authenticateToken);

router.get('/', async (req, res, next) => {
  try { const r = await pool.query('SELECT * FROM governed_investigations WHERE tenant_id=$1 ORDER BY score DESC NULLS LAST,created_at DESC LIMIT 100',[tenant(req.user)]); res.json({ investigations:r.rows }); }
  catch (e) { next(e); }
});

router.post('/ingest', async (req, res, next) => {
  let tx;
  try { tx = normalizeTransaction(req.body || {}); } catch (e) { return res.status(400).json({ error:e.message }); }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO governed_investigations(tenant_id,external_id,normalized_transaction,created_by)
       VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,external_id) DO UPDATE SET external_id=EXCLUDED.external_id RETURNING *`,
      [tenant(req.user),tx.externalId,tx,req.user.id]
    );
    await client.query(
      `INSERT INTO governed_investigation_events(tenant_id,investigation_id,actor_id,action,to_state,evidence)
       SELECT $1,$2,$3,'transaction_ingested','ingested',$4 WHERE NOT EXISTS
       (SELECT 1 FROM governed_investigation_events WHERE investigation_id=$2 AND action='transaction_ingested')`,
      [tenant(req.user),r.rows[0].id,req.user.id,tx]
    );
    await client.query('COMMIT'); res.status(201).json(r.rows[0]);
  } catch(e) { if (client) await client.query('ROLLBACK'); next(e); } finally { client?.release(); }
});

router.post('/:id/score', async (req,res,next) => {
  let client;
  try {
    client=await pool.connect();
    await client.query('BEGIN');
    const f=await client.query('SELECT * FROM governed_investigations WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[req.params.id,tenant(req.user)]);
    if(!f.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Investigation not found'});}
    assertTransition(f.rows[0].state,'scored',{role:req.user.role});
    const result=scoreTypologies(f.rows[0].normalized_transaction,req.body?.signals||{});
    const u=await client.query(`UPDATE governed_investigations SET state='scored',score=$1,score_reasons=$2,model_version=$3,version=version+1,updated_at=NOW() WHERE id=$4 RETURNING *`,[result.score,result.reasons,result.modelVersion,f.rows[0].id]);
    await client.query(`INSERT INTO governed_investigation_events(tenant_id,investigation_id,actor_id,action,from_state,to_state,evidence) VALUES($1,$2,$3,'rules_scored',$4,'scored',$5)`,[tenant(req.user),f.rows[0].id,req.user.id,f.rows[0].state,result]);
    await client.query('COMMIT');res.json(u.rows[0]);
  }catch(e){if(client)await client.query('ROLLBACK');if(/Invalid transition/.test(e.message))return res.status(422).json({error:e.message});next(e);}finally{client?.release();}
});

router.post('/:id/transition', async(req,res,next)=>{
  const {to,rationale,disposition,expectedVersion,assignedTo}=req.body||{}; let client;
  try{client=await pool.connect();await client.query('BEGIN');const f=await client.query('SELECT * FROM governed_investigations WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[req.params.id,tenant(req.user)]);
    if(!f.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Investigation not found'});} const row=f.rows[0];
    if(Number(expectedVersion)!==row.version){await client.query('ROLLBACK');return res.status(409).json({error:'Stale investigation version'});}
    assertTransition(row.state,to,{role:req.user.role,creatorId:row.created_by,actorId:req.user.id,rationale});
    if(assignedTo){const assignee=await client.query("SELECT id FROM users WHERE id=$1 AND tenant_id=$2 AND role IN ('analyst','reviewer','admin')",[assignedTo,tenant(req.user)]);if(!assignee.rows.length){await client.query('ROLLBACK');return res.status(422).json({error:'Assignee must be an eligible user in this organization'});}}
    const u=await client.query('UPDATE governed_investigations SET state=$1,disposition=$2,assigned_to=COALESCE($3,assigned_to),version=version+1,updated_at=NOW() WHERE id=$4 RETURNING *',[to,disposition||null,assignedTo||null,row.id]);
    await client.query(`INSERT INTO governed_investigation_events(tenant_id,investigation_id,actor_id,action,from_state,to_state,rationale,evidence) VALUES($1,$2,$3,'analyst_transition',$4,$5,$6,$7)`,[tenant(req.user),row.id,req.user.id,row.state,to,rationale||null,{disposition:disposition||null}]);
    await client.query('COMMIT');res.json(u.rows[0]);
  }catch(e){if(client)await client.query('ROLLBACK');if(/Invalid|Reviewer|Segregation|rationale/.test(e.message))return res.status(422).json({error:e.message});next(e);}finally{client?.release();}
});

router.post('/providers/:provider/enqueue',requireReviewer,async(req,res,next)=>{const allowed=['bank_feed','sanctions_pep','case_management','regulatory_reporting'];if(!allowed.includes(req.params.provider))return res.status(400).json({error:'Unsupported provider'});const {operation,payloadReference,idempotencyKey}=req.body||{};if(!operation||!payloadReference||!idempotencyKey)return res.status(400).json({error:'operation, payloadReference and idempotencyKey required'});try{const r=await pool.query(`INSERT INTO fraud_provider_outbox(tenant_id,provider,operation,payload_reference,idempotency_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,provider,idempotency_key) DO NOTHING RETURNING *`,[tenant(req.user),req.params.provider,operation,payloadReference,idempotencyKey]);if(r.rows.length)return res.status(202).json(r.rows[0]);const replay=await pool.query('SELECT * FROM fraud_provider_outbox WHERE tenant_id=$1 AND provider=$2 AND idempotency_key=$3',[tenant(req.user),req.params.provider,idempotencyKey]);const prior=replay.rows[0];if(prior.operation!==operation||prior.payload_reference!==payloadReference)return res.status(409).json({error:'Idempotency key was already used for a different operation'});res.status(200).json(prior);}catch(e){next(e);}});
router.post('/evaluations', async (req, res, next) => {
  if (!['reviewer','admin'].includes(req.user.role)) return res.status(403).json({error:'Reviewer role required'});
  try {
    const metrics=evaluateAlerts(req.body?.labelledAlerts);
    const result=await pool.query('INSERT INTO fraud_evaluation_runs(tenant_id,created_by,cohort_reference,model_version,metrics,labelled_count) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[tenant(req.user),req.user.id,req.body?.cohortReference||'unspecified',req.body?.modelVersion||'rules-2026-07-18',metrics,metrics.sampleSize]);
    res.status(201).json(result.rows[0]);
  } catch(e) { if(/required|labelled/.test(e.message)) return res.status(400).json({error:e.message}); next(e); }
});
module.exports=router;
