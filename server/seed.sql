-- Anti-Fraud & Credit Analysis Engine - Seed Data
-- Run AFTER schema.sql: psql $DATABASE_URL -f server/seed.sql

BEGIN;

-- ============================================================
-- USERS (3 users: admin, analyst, reviewer)
-- passwords are bcrypt hashes of 'password123'
-- ============================================================
INSERT INTO users (email, password_hash, name, role) VALUES
  ('admin@antifraud.com',    '$2a$10$VY.Mg1tNpqHd.zDNzIa3S.Rc0BobBMiUcsU2bZ2J0NOdhN5ypj8aK', 'Alice Morgan',   'admin'),
  ('analyst@antifraud.com',  '$2a$10$VY.Mg1tNpqHd.zDNzIa3S.Rc0BobBMiUcsU2bZ2J0NOdhN5ypj8aK', 'Brian Castillo', 'analyst'),
  ('reviewer@antifraud.com', '$2a$10$VY.Mg1tNpqHd.zDNzIa3S.Rc0BobBMiUcsU2bZ2J0NOdhN5ypj8aK', 'Carol Hayes',    'reviewer');

-- ============================================================
-- FRAUD RULES (15 rules)
-- ============================================================
INSERT INTO fraud_rules (name, description, rule_type, condition_json, action, severity, is_active) VALUES
  ('High-Value Transaction',       'Flag transactions above $5,000',                                   'threshold',      '{"field":"amount","operator":"gt","value":5000}',                                                        'flag',  'high',     TRUE),
  ('Velocity Check - Hourly',      'Block if more than 5 transactions in 1 hour from same card',       'velocity',       '{"window_minutes":60,"max_count":5,"group_by":"card_number_last4"}',                                    'block', 'critical', TRUE),
  ('Cross-Border Transaction',     'Flag transactions from high-risk countries',                        'geo',            '{"countries":["NG","RU","KP","IR","SY"],"field":"location_country"}',                                   'flag',  'high',     TRUE),
  ('New Device Login',             'Alert on transactions from unrecognized device IDs',               'device',         '{"check":"new_device","threshold_days":30}',                                                             'alert', 'medium',   TRUE),
  ('Night-Time Large Purchase',    'Flag large purchases between 00:00 and 05:00',                     'time_based',     '{"start_hour":0,"end_hour":5,"amount_threshold":500}',                                                   'flag',  'medium',   TRUE),
  ('Round Amount Pattern',         'Flag suspiciously round transaction amounts',                       'pattern',        '{"pattern":"round_amount","modulo":1000,"equals":0}',                                                   'alert', 'low',      TRUE),
  ('Rapid Successive Transactions','Block more than 3 transactions within 10 minutes',                 'velocity',       '{"window_minutes":10,"max_count":3,"group_by":"user_id"}',                                              'block', 'critical', TRUE),
  ('Card Not Present High Risk',   'Flag CNP (online) transactions over $1,000',                       'threshold',      '{"field":"amount","operator":"gt","value":1000,"condition":"is_online=true"}',                          'flag',  'high',     TRUE),
  ('Merchant Blacklist Match',     'Block transactions at known fraudulent merchants',                  'blacklist',      '{"list_type":"merchant_blacklist","field":"merchant_name"}',                                            'block', 'critical', TRUE),
  ('Unusual Merchant Category',    'Alert on MCC codes associated with high fraud rates',               'category',       '{"categories":["gambling","crypto_exchange","wire_transfer"],"action_threshold":200}',                  'alert', 'medium',   TRUE),
  ('Geographic Anomaly',           'Flag if transaction location is 1000+ miles from last transaction','geo_anomaly',    '{"distance_km":1609,"time_window_minutes":120}',                                                        'flag',  'high',     TRUE),
  ('Low Credit Score Purchase',    'Alert on large purchases by low credit score customers',           'credit_based',   '{"credit_score_max":580,"amount_threshold":2000}',                                                      'alert', 'medium',   TRUE),
  ('Multiple Declined Retries',    'Block card after 3 consecutive declines',                          'pattern',        '{"consecutive_declines":3,"window_minutes":30}',                                                        'block', 'high',     TRUE),
  ('Crypto Exchange Transfers',    'Flag all transfers to cryptocurrency exchanges',                    'category',       '{"categories":["crypto_exchange"],"min_amount":100}',                                                   'flag',  'high',     TRUE),
  ('First Transaction Abroad',     'Alert when a customer transacts internationally for the first time','geo',            '{"check":"first_international","base_country":"US"}',                                                   'alert', 'medium',   FALSE);

-- ============================================================
-- TRANSACTIONS (20 transactions)
-- ============================================================
INSERT INTO transactions (user_id, amount, currency, merchant_name, merchant_category, card_number_last4, ip_address, location_country, location_city, device_id, is_online, status, risk_score, fraud_confirmed) VALUES
  (2, 125.50,   'USD', 'Amazon',              'retail',           '4532', '198.41.128.1',   'US', 'Seattle',      'dev-a1b2c3',   TRUE,  'approved', 8.5,  FALSE),
  (2, 7850.00,  'USD', 'Wire Transfer Co',    'wire_transfer',    '7891', '91.203.77.12',   'RU', 'Moscow',       'dev-d4e5f6',   TRUE,  'blocked',  97.2, TRUE),
  (3, 340.00,   'USD', 'Best Buy',            'electronics',      '2210', '72.21.196.65',   'US', 'Chicago',      'dev-g7h8i9',   FALSE, 'approved', 12.0, FALSE),
  (2, 5500.00,  'USD', 'Luxury Jewelers Inc', 'jewelry',          '3344', '185.220.101.35', 'GB', 'London',       'dev-j1k2l3',   FALSE, 'flagged',  76.8, FALSE),
  (1, 29.99,    'USD', 'Netflix',             'streaming',        '6677', '52.3.100.42',    'US', 'Los Angeles',  'dev-m4n5o6',   TRUE,  'approved', 3.1,  FALSE),
  (3, 12500.00, 'USD', 'CryptoSwap Exchange', 'crypto_exchange',  '8899', '45.142.212.100', 'NG', 'Lagos',        'dev-p7q8r9',   TRUE,  'blocked',  99.1, TRUE),
  (2, 180.00,   'USD', 'Shell Gas Station',   'fuel',             '1122', '68.105.28.91',   'US', 'Houston',      'dev-s1t2u3',   FALSE, 'approved', 5.2,  FALSE),
  (3, 2200.00,  'USD', 'Apple Store',         'electronics',      '3344', '17.253.144.10',  'US', 'New York',     'dev-v4w5x6',   TRUE,  'flagged',  58.4, FALSE),
  (1, 450.00,   'USD', 'Delta Airlines',      'travel',           '5566', '199.59.148.14',  'US', 'Atlanta',      'dev-y7z8a9',   TRUE,  'approved', 14.7, FALSE),
  (2, 89.00,    'USD', 'Walmart',             'retail',           '4532', '198.41.128.5',   'US', 'Dallas',       'dev-b1c2d3',   FALSE, 'approved', 6.8,  FALSE),
  (3, 9999.00,  'USD', 'Fast Cash Transfer',  'wire_transfer',    '7891', '77.88.55.66',    'KP', 'Pyongyang',    'dev-e4f5g6',   TRUE,  'blocked',  99.9, TRUE),
  (2, 650.00,   'USD', 'Marriott Hotels',     'hotel',            '2210', '52.92.139.32',   'US', 'Miami',        'dev-h7i8j9',   TRUE,  'approved', 22.3, FALSE),
  (1, 3300.00,  'USD', 'AutoTrader',          'automotive',       '3344', '216.58.194.46',  'US', 'Detroit',      'dev-k1l2m3',   TRUE,  'flagged',  61.5, FALSE),
  (3, 75.50,    'USD', 'Starbucks',           'food_beverage',    '6677', '104.16.248.249', 'US', 'San Francisco','dev-n4o5p6',   FALSE, 'approved', 2.4,  FALSE),
  (2, 14000.00, 'USD', 'GoldBars Direct',     'precious_metals',  '9900', '109.94.208.55',  'IR', 'Tehran',       'dev-q7r8s9',   TRUE,  'blocked',  98.7, TRUE),
  (1, 220.00,   'USD', 'Target',              'retail',           '1122', '52.95.120.68',   'US', 'Phoenix',      'dev-t1u2v3',   FALSE, 'approved', 9.1,  FALSE),
  (3, 1800.00,  'USD', 'Gaming Palace Casino','gambling',         '3344', '185.130.104.71', 'GB', 'London',       'dev-w4x5y6',   TRUE,  'flagged',  84.2, FALSE),
  (2, 410.00,   'USD', 'Home Depot',          'home_improvement', '4532', '198.41.128.9',   'US', 'Boston',       'dev-z7a8b9',   FALSE, 'approved', 7.3,  FALSE),
  (1, 5000.00,  'USD', 'Blank Check LLC',     'financial',        '8899', '91.108.4.100',   'SY', 'Damascus',     'dev-c1d2e3',   TRUE,  'blocked',  96.3, TRUE),
  (3, 130.00,   'USD', 'Uber',                'transportation',   '5566', '162.158.158.92', 'US', 'New York',     'dev-f4g5h6',   TRUE,  'approved', 4.9,  FALSE);

-- ============================================================
-- FRAUD ALERTS (18 alerts)
-- ============================================================
INSERT INTO fraud_alerts (transaction_id, rule_id, alert_type, severity, description, status, assigned_to) VALUES
  (2,  2,  'velocity_breach',        'critical', 'Card 7891 triggered velocity rule: 6 transactions in 45 minutes originating from Moscow, Russia.',        'investigating', 2),
  (6,  3,  'geo_high_risk',          'critical', 'Transaction from Nigeria (NG) to CryptoSwap Exchange for $12,500. Country is on high-risk list.',          'open',          NULL),
  (11, 9,  'blacklist_match',        'critical', 'Merchant "Fast Cash Transfer" matches known fraudulent merchant blacklist. Transaction blocked.',           'resolved',      1),
  (15, 3,  'geo_high_risk',          'critical', 'Transaction origin Iran (IR) flagged. GoldBars Direct purchase of $14,000 blocked automatically.',         'resolved',      1),
  (19, 9,  'blacklist_match',        'high',     '"Blank Check LLC" in Syria matches shell company watchlist. Transaction blocked.',                          'open',          2),
  (4,  1,  'high_value',             'high',     'Transaction of $5,500 at Luxury Jewelers Inc in London exceeds high-value threshold.',                     'investigating', 3),
  (8,  8,  'cnp_high_value',         'high',     'Card-not-present online transaction of $2,200 at Apple Store triggers CNP high-risk rule.',                'open',          2),
  (13, 1,  'high_value',             'high',     'AutoTrader transaction of $3,300 flagged. First large automotive purchase on this account.',                'open',          3),
  (17, 10, 'unusual_category',       'high',     'Gambling transaction at Gaming Palace Casino for $1,800. Card 3344 has no prior gambling history.',        'investigating', 2),
  (2,  11, 'geo_anomaly',            'high',     'Transaction 2,000+ miles from last known location. Previous transaction in US, current in Russia.',        'resolved',      1),
  (6,  14, 'crypto_transfer',        'high',     'Large crypto exchange transfer of $12,500. Combined with high-risk country flag raises alert level.',       'resolved',      1),
  (4,  5,  'night_time_purchase',    'medium',   'Luxury jewelry purchase of $5,500 occurred at 02:14 AM local time. Triggers night-time large purchase rule.','open',        NULL),
  (8,  4,  'new_device',             'medium',   'Apple Store transaction initiated from device ID not seen in the last 90 days.',                            'open',          NULL),
  (13, 6,  'round_amount_pattern',   'medium',   '$3,300 is a suspiciously round number on a first-time merchant. Possible test transaction pattern.',        'dismissed',     3),
  (17, 5,  'night_time_purchase',    'medium',   'Casino transaction placed at 01:47 AM. Night-time large purchase rule triggered.',                          'investigating', 2),
  (3,  4,  'new_device_alert',       'low',      'Best Buy purchase from device registered less than 24 hours ago. Low risk but logged.',                     'dismissed',     3),
  (9,  4,  'new_device_alert',       'low',      'Delta Airlines booking from new browser fingerprint. Travel bookings are expected, low anomaly.',           'dismissed',     3),
  (12, 12, 'low_credit_high_spend',  'medium',   'Marriott booking of $650 by customer with credit score 560. Exceeds recommended spending limit.',           'open',          2);

-- ============================================================
-- CREDIT SCORES (15 records)
-- ============================================================
INSERT INTO credit_scores (customer_name, customer_email, ssn_last4, credit_score, risk_level, income, debt_to_income, payment_history_score, credit_utilization, account_age_months, num_accounts, num_late_payments, loan_amount_requested, loan_purpose, ai_recommendation, ai_risk_analysis) VALUES
  ('James Anderson',    'james.anderson@email.com',    '4521', 780, 'low',      95000.00, 18.5,  98.2, 12.3, 144, 8,  0, 25000.00,  'home_improvement', 'APPROVE', to_jsonb('Excellent credit profile. Low DTI ratio and zero late payments. High approval confidence.'::text)),
  ('Maria Rodriguez',   'maria.rodriguez@email.com',   '8832', 620, 'medium',   52000.00, 34.8,  78.5, 45.2, 72,  5,  3, 10000.00,  'debt_consolidation','CONDITIONAL', to_jsonb('Moderate risk. Elevated credit utilization and 3 late payments. Recommend lower loan amount or co-signer.'::text)),
  ('David Chen',        'david.chen@email.com',        '3317', 450, 'very_high',31000.00, 58.2,  45.0, 88.7, 24,  4,  12,5000.00,  'personal',         'DECLINE', to_jsonb('High-risk applicant. Very high utilization, numerous late payments, and excessive DTI. Likely default risk.'::text)),
  ('Sarah Thompson',    'sarah.thompson@email.com',    '7749', 810, 'very_low', 140000.00,12.1,  99.5, 8.4,  216, 12, 0, 75000.00,  'home_purchase',    'APPROVE', to_jsonb('Prime borrower. Outstanding payment history, low utilization, high income. Excellent approval candidate.'::text)),
  ('Robert Johnson',    'robert.johnson@email.com',    '2263', 560, 'high',     44000.00, 48.7,  62.3, 72.1, 48,  3,  7, 8000.00,   'auto_loan',        'DECLINE', to_jsonb('Sub-prime profile. DTI near 50% and high utilization. Auto loan approval not recommended at this time.'::text)),
  ('Linda Martinez',    'linda.martinez@email.com',    '5598', 710, 'low',      78000.00, 24.3,  91.0, 28.5, 120, 7,  1, 20000.00,  'education',        'APPROVE', to_jsonb('Good credit standing. Minor late payment history but strong overall profile. Approve with standard terms.'::text)),
  ('Michael Brown',     'michael.brown@email.com',     '9901', 680, 'medium',   63000.00, 31.6,  84.7, 38.9, 96,  6,  2, 15000.00,  'home_improvement', 'CONDITIONAL', to_jsonb('Acceptable risk. Slightly elevated utilization but improving payment trends. Recommend standard review.'::text)),
  ('Jennifer Davis',    'jennifer.davis@email.com',    '1145', 390, 'very_high',24000.00, 71.4,  31.2, 95.8, 12,  2,  18,3000.00,  'personal',         'DECLINE', to_jsonb('Extreme risk indicator. 18 late payments, 95% utilization, and income insufficient for requested amount.'::text)),
  ('Christopher Wilson','christopher.wilson@email.com','6623', 740, 'low',      88000.00, 21.8,  95.5, 19.7, 168, 9,  0, 35000.00,  'business',         'APPROVE', to_jsonb('Strong candidate. Long credit history, zero late payments, manageable DTI. Business loan approved.'::text)),
  ('Amanda Taylor',     'amanda.taylor@email.com',     '3378', 590, 'high',     41000.00, 44.2,  68.9, 61.3, 36,  4,  5, 6000.00,   'medical',          'CONDITIONAL', to_jsonb('Elevated risk. High utilization and recurring late payments. Medical loan: recommend small amount approval.'::text)),
  ('Daniel Harris',     'daniel.harris@email.com',     '8812', 490, 'very_high',28000.00, 63.5,  48.1, 83.2, 18,  3,  14,4000.00,  'personal',         'DECLINE', to_jsonb('Very high risk score. Insufficient credit history and high delinquency rate. Do not approve.'::text)),
  ('Jessica Lee',       'jessica.lee@email.com',       '5534', 760, 'low',      105000.00,16.7,  97.8, 14.2, 192, 10, 0, 50000.00,  'home_purchase',    'APPROVE', to_jsonb('Excellent profile. Near-perfect payment history, low utilization, high income. Approve at best rate.'::text)),
  ('William Clark',     'william.clark@email.com',     '2289', 640, 'medium',   55000.00, 37.4,  80.2, 41.6, 60,  5,  4, 12000.00,  'auto_loan',        'CONDITIONAL', to_jsonb('Moderate risk. Average payment consistency with manageable DTI. Conditional approval at higher rate.'::text)),
  ('Melissa White',     'melissa.white@email.com',     '7756', 520, 'high',     37000.00, 52.8,  56.4, 78.9, 30,  3,  9, 5500.00,   'debt_consolidation','DECLINE', to_jsonb('High-risk borrower. Consolidation loan would increase overall debt burden. Not recommended.'::text)),
  ('Anthony Scott',     'anthony.scott@email.com',     '4490', 690, 'medium',   68000.00, 29.1,  88.6, 33.7, 108, 7,  2, 18000.00,  'education',        'APPROVE', to_jsonb('Moderate-to-good profile. Solid income and payment history support education loan approval.'::text));

-- ============================================================
-- RISK MODELS (15 models)
-- ============================================================
INSERT INTO risk_models (name, description, model_type, accuracy, precision_score, recall_score, f1_score, status, last_trained_at) VALUES
  ('TransactionRisk v3.2',        'Primary real-time transaction fraud detection model using gradient boosting',             'gradient_boosting',   0.9847, 0.9612, 0.9734, 0.9672, 'active',   '2024-11-15 08:00:00+00'),
  ('BehavioralAnomaly v1.5',      'Unsupervised anomaly detection for behavioral deviation analysis',                         'isolation_forest',    0.9423, 0.9011, 0.9278, 0.9143, 'active',   '2024-10-22 10:30:00+00'),
  ('CreditRisk XGBoost v2.1',     'Credit scoring model trained on historical loan performance data',                         'xgboost',             0.9256, 0.9134, 0.9087, 0.9110, 'active',   '2024-09-30 14:15:00+00'),
  ('VelocityDetector v2.0',       'Detects card skimming and velocity attacks through time-series analysis',                  'lstm_rnn',            0.9689, 0.9521, 0.9603, 0.9561, 'active',   '2024-12-01 06:00:00+00'),
  ('GeoRisk Neural Net v1.0',     'Geospatial risk scoring using neural networks and IP intelligence feeds',                  'neural_network',      0.9314, 0.9088, 0.9201, 0.9144, 'active',   '2024-11-05 12:00:00+00'),
  ('MerchantRisk RF v1.8',        'Random forest classifier for merchant-level fraud risk profiling',                         'random_forest',       0.9178, 0.8934, 0.9067, 0.9000, 'active',   '2024-10-10 09:45:00+00'),
  ('DeepFraud BERT v0.9',         'Transformer-based model for pattern matching across unstructured transaction notes',       'transformer',         0.9532, 0.9344, 0.9478, 0.9410, 'training', NULL),
  ('CardNotPresent v2.3',         'Specialized model for e-commerce and CNP fraud detection',                                 'gradient_boosting',   0.9401, 0.9189, 0.9312, 0.9250, 'active',   '2024-11-20 16:00:00+00'),
  ('IdentityFraud v1.2',          'Identity theft and synthetic identity detection using graph neural networks',              'graph_neural_net',    0.9267, 0.9045, 0.9122, 0.9083, 'inactive', '2024-08-15 11:00:00+00'),
  ('MoneyLaundering AML v1.0',    'AML transaction monitoring using network analysis and rule-based ML hybrid',               'hybrid_ml',           0.9588, 0.9401, 0.9512, 0.9456, 'active',   '2024-12-05 08:30:00+00'),
  ('AccountTakeover v2.5',        'Detects account takeover attempts through login behavior analysis',                        'random_forest',       0.9712, 0.9567, 0.9634, 0.9600, 'active',   '2024-11-28 07:00:00+00'),
  ('SyntheticID Detector v1.1',   'Identifies synthetic identity fraud using cross-reference bureau data',                    'ensemble',            0.9089, 0.8867, 0.8978, 0.8922, 'training', NULL),
  ('PhishingCorrelation v1.0',    'Correlates transaction patterns with known phishing campaign indicators',                  'clustering',          0.8945, 0.8712, 0.8834, 0.8772, 'inactive', '2024-07-20 13:00:00+00'),
  ('RealTimeScorer v4.0',         'Low-latency ensemble scoring model for sub-100ms real-time decisions',                    'ensemble',            0.9923, 0.9801, 0.9867, 0.9834, 'active',   '2024-12-10 05:00:00+00'),
  ('FirstPartyFraud v1.3',        'Detects first-party fraud including friendly fraud and bust-out schemes',                  'gradient_boosting',   0.9134, 0.8945, 0.9034, 0.8989, 'archived', '2024-06-01 10:00:00+00');

-- ============================================================
-- WATCHLIST (15 entries)
-- ============================================================
INSERT INTO watchlist (entity_name, entity_type, identifier, reason, risk_level, source, is_active, added_by) VALUES
  ('Dmitri Volkov',          'individual',   'PASS-RU-77123456',  'Linked to multiple wire fraud schemes across Eastern Europe',                  'very_high', 'Interpol Red Notice',        TRUE,  1),
  ('FastCash Wire Services', 'organization', 'MCC-6099-FASTCASH', 'Shell company used for money laundering; 3 confirmed fraud cases',            'very_high', 'FinCEN SAR Database',         TRUE,  1),
  ('Kim Jae-won',            'individual',   'PASS-KP-00923',     'North Korean operative linked to cyber-enabled financial crimes',              'very_high', 'OFAC SDN List',              TRUE,  1),
  ('Ali Hassan Mahmoud',     'individual',   'PASS-SY-34512',     'Syrian national flagged for terror financing and hawala network participation', 'very_high', 'OFAC SDN List',              TRUE,  1),
  ('Sunset Trading Corp',    'organization', 'EIN-88-4421009',    'Phantom merchant used in card-not-present fraud ring; 45 chargebacks',         'high',      'Internal Investigation',      TRUE,  2),
  ('Priya Narayan',          'individual',   'SSN-XXX-XX-7890',   'Synthetic identity fraud; opened 8 credit lines with fabricated SSN',          'high',      'Credit Bureau Referral',      TRUE,  2),
  ('Global Exchange Network','organization', 'BIC-GEXNUSD1',      'Unlicensed money transmitter operating in restricted jurisdictions',            'high',      'FINCEN Advisory',             TRUE,  1),
  ('Oluwaseun Adeyemi',      'individual',   'PASS-NG-55012',     'Romance scam operator; victim losses exceed $2.3M across 12 states',           'high',      'FBI IC3 Referral',            TRUE,  2),
  ('Raven Crypto Exchange',  'organization', 'RAVEN-CRYPTO-01',   'Unregistered crypto exchange facilitating ransomware payment laundering',      'very_high', 'OFAC Virtual Currency List', TRUE,  1),
  ('Marcus DeWitt',          'individual',   'DL-TX-4422891',     'Identity thief; confirmed 12 fraudulent account openings in 3 states',         'high',      'State AG Referral',           TRUE,  2),
  ('TechVault Solutions',    'organization', 'VAT-EU-998877',     'Shell company linked to CEO fraud (BEC) targeting Fortune 500 companies',      'high',      'FBI Referral',                TRUE,  1),
  ('Aleksei Petrov',         'individual',   'PASS-RU-44123789',  'Carding forum operator; responsible for selling 200k+ stolen card numbers',   'very_high', 'Europol Liaison',             TRUE,  1),
  ('Carlos Mendez',          'individual',   'PASS-MX-22345',     'Drug cartel financial facilitator; flagged for structuring and smurfing',      'very_high', 'DEA Referral',                TRUE,  1),
  ('QuickLoans Direct',      'organization', 'NMLS-QUICK-99012',  'Predatory lending operation flagged for fraudulent loan origination',          'medium',    'CFPB Complaint Database',     TRUE,  3),
  ('Nathaniel Brooks',       'individual',   'SSN-XXX-XX-4412',   'Former bank employee involved in insider trading and account manipulation',     'medium',    'Internal HR Investigation',   FALSE, 1);

-- ============================================================
-- AUDIT LOG (20 entries)
-- ============================================================
INSERT INTO audit_log (user_id, action, entity_type, entity_id, details_json, ip_address) VALUES
  (1, 'LOGIN',             'user',          1,  '{"method":"password","success":true,"browser":"Chrome 120"}',                         '10.0.0.1'),
  (1, 'CREATE_RULE',       'fraud_rules',   1,  '{"rule_name":"High-Value Transaction","threshold":5000}',                              '10.0.0.1'),
  (2, 'LOGIN',             'user',          2,  '{"method":"password","success":true,"browser":"Firefox 121"}',                        '10.0.0.2'),
  (2, 'VIEW_TRANSACTION',  'transactions',  2,  '{"transaction_amount":7850.00,"merchant":"Wire Transfer Co","status":"blocked"}',      '10.0.0.2'),
  (1, 'UPDATE_ALERT',      'fraud_alerts',  3,  '{"old_status":"investigating","new_status":"resolved","resolution":"confirmed_fraud"}','10.0.0.1'),
  (3, 'LOGIN',             'user',          3,  '{"method":"password","success":true,"browser":"Safari 17"}',                          '10.0.0.3'),
  (2, 'RUN_AI_ANALYSIS',   'transactions',  6,  '{"model":"claude-haiku","result":"critical_risk","score":99.1}',                      '10.0.0.2'),
  (1, 'ADD_WATCHLIST',     'watchlist',     1,  '{"entity":"Dmitri Volkov","source":"Interpol Red Notice","risk":"very_high"}',         '10.0.0.1'),
  (3, 'VIEW_CREDIT_SCORE', 'credit_scores', 3,  '{"customer":"David Chen","score":450,"recommendation":"DECLINE"}',                    '10.0.0.3'),
  (1, 'CREATE_RULE',       'fraud_rules',   7,  '{"rule_name":"Rapid Successive Transactions","window":10,"max":3}',                   '10.0.0.1'),
  (2, 'FLAG_TRANSACTION',  'transactions',  4,  '{"transaction_amount":5500.00,"merchant":"Luxury Jewelers Inc","risk_score":76.8}',   '10.0.0.2'),
  (1, 'DISABLE_RULE',      'fraud_rules',   15, '{"rule_name":"First Transaction Abroad","reason":"high false positive rate"}',         '10.0.0.1'),
  (3, 'ASSIGN_ALERT',      'fraud_alerts',  1,  '{"alert_id":1,"assigned_to_user_id":2,"assigned_by":3}',                             '10.0.0.3'),
  (2, 'UPDATE_CREDIT',     'credit_scores', 2,  '{"customer":"Maria Rodriguez","old_recommendation":null,"new_recommendation":"CONDITIONAL"}','10.0.0.2'),
  (1, 'EXPORT_REPORT',     'audit_log',     NULL,'{"report_type":"monthly_fraud_summary","period":"2024-11","records":847}',           '10.0.0.1'),
  (1, 'ADD_WATCHLIST',     'watchlist',     9,  '{"entity":"Raven Crypto Exchange","source":"OFAC","risk":"very_high"}',                '10.0.0.1'),
  (2, 'BULK_REVIEW',       'fraud_alerts',  NULL,'{"alerts_reviewed":12,"resolved":8,"dismissed":4,"period":"2024-12-01"}',            '10.0.0.2'),
  (3, 'LOGIN_FAILED',      'user',          3,  '{"method":"password","success":false,"reason":"invalid_password","attempt":1}',       '192.168.1.50'),
  (1, 'TRAIN_MODEL',       'risk_models',   14, '{"model_name":"RealTimeScorer v4.0","accuracy":0.9923,"duration_minutes":142}',       '10.0.0.1'),
  (2, 'DISMISS_ALERT',     'fraud_alerts',  14, '{"alert_id":14,"reason":"false_positive","rule_id":6}',                              '10.0.0.2');

-- ============================================================
-- BEHAVIORAL PATTERNS (15 records)
-- ============================================================
INSERT INTO behavioral_patterns (customer_id, pattern_type, avg_transaction_amount, max_transaction_amount, typical_locations, typical_times, device_fingerprints, anomaly_score) VALUES
  ('CUST-001', 'spending',   145.50,  2500.00,  '[{"country":"US","city":"Seattle","frequency":0.85},{"country":"US","city":"Portland","frequency":0.15}]',           '{"weekday_peak":"12:00-14:00","weekend_peak":"10:00-16:00","night_activity":0.02}',            '[{"id":"dev-a1b2c3","os":"macOS","browser":"Chrome","last_seen":"2024-12-10"},{"id":"dev-mob001","os":"iOS","browser":"Safari","last_seen":"2024-12-09"}]', 8.5),
  ('CUST-002', 'spending',   890.00,  15000.00, '[{"country":"RU","city":"Moscow","frequency":0.60},{"country":"US","city":"New York","frequency":0.40}]',            '{"weekday_peak":"02:00-04:00","weekend_peak":"01:00-05:00","night_activity":0.75}',            '[{"id":"dev-d4e5f6","os":"Windows","browser":"Firefox","last_seen":"2024-12-10"},{"id":"dev-vpn001","os":"Linux","browser":"Tor","last_seen":"2024-12-08"}]', 94.2),
  ('CUST-003', 'spending',   210.75,  3400.00,  '[{"country":"US","city":"Chicago","frequency":0.90},{"country":"US","city":"Milwaukee","frequency":0.10}]',         '{"weekday_peak":"09:00-11:00","weekend_peak":"13:00-17:00","night_activity":0.04}',            '[{"id":"dev-g7h8i9","os":"Windows","browser":"Chrome","last_seen":"2024-12-10"}]',                                                                           12.1),
  ('CUST-004', 'mixed',      4200.00, 25000.00, '[{"country":"GB","city":"London","frequency":0.50},{"country":"UAE","city":"Dubai","frequency":0.35},{"country":"US","city":"Miami","frequency":0.15}]','{"weekday_peak":"11:00-13:00","weekend_peak":"20:00-23:00","night_activity":0.30}',    '[{"id":"dev-j1k2l3","os":"iOS","browser":"Safari","last_seen":"2024-12-10"}]',                                                                               68.9),
  ('CUST-005', 'spending',   32.50,   450.00,   '[{"country":"US","city":"Los Angeles","frequency":1.00}]',                                                          '{"weekday_peak":"08:00-09:00","weekend_peak":"10:00-12:00","night_activity":0.01}',            '[{"id":"dev-m4n5o6","os":"Android","browser":"Chrome Mobile","last_seen":"2024-12-10"}]',                                                                     3.2),
  ('CUST-006', 'high_risk',  8750.00, 50000.00, '[{"country":"NG","city":"Lagos","frequency":0.70},{"country":"GH","city":"Accra","frequency":0.30}]',               '{"weekday_peak":"03:00-05:00","weekend_peak":"02:00-06:00","night_activity":0.88}',            '[{"id":"dev-p7q8r9","os":"Windows","browser":"Chrome","last_seen":"2024-12-10"},{"id":"dev-vpn002","os":"Linux","browser":"Unknown","last_seen":"2024-12-09"}]',99.1),
  ('CUST-007', 'spending',   95.00,   800.00,   '[{"country":"US","city":"Houston","frequency":0.95},{"country":"US","city":"Austin","frequency":0.05}]',            '{"weekday_peak":"07:00-08:00","weekend_peak":"11:00-15:00","night_activity":0.03}',            '[{"id":"dev-s1t2u3","os":"macOS","browser":"Safari","last_seen":"2024-12-10"}]',                                                                              5.4),
  ('CUST-008', 'anomalous',  1650.00, 12000.00, '[{"country":"US","city":"New York","frequency":0.45},{"country":"JP","city":"Tokyo","frequency":0.35},{"country":"SG","city":"Singapore","frequency":0.20}]','{"weekday_peak":"10:00-12:00","weekend_peak":"14:00-18:00","night_activity":0.25}','[{"id":"dev-v4w5x6","os":"Windows","browser":"Edge","last_seen":"2024-12-10"},{"id":"dev-tab001","os":"iPadOS","browser":"Safari","last_seen":"2024-12-08"}]',  62.3),
  ('CUST-009', 'spending',   380.00,  5500.00,  '[{"country":"US","city":"Atlanta","frequency":0.80},{"country":"US","city":"Nashville","frequency":0.20}]',         '{"weekday_peak":"09:00-12:00","weekend_peak":"10:00-14:00","night_activity":0.05}',            '[{"id":"dev-y7z8a9","os":"iOS","browser":"Safari","last_seen":"2024-12-10"},{"id":"dev-lap002","os":"macOS","browser":"Chrome","last_seen":"2024-12-09"}]',    18.7),
  ('CUST-010', 'spending',   72.00,   1200.00,  '[{"country":"US","city":"Dallas","frequency":0.92},{"country":"US","city":"Fort Worth","frequency":0.08}]',         '{"weekday_peak":"12:00-13:00","weekend_peak":"15:00-19:00","night_activity":0.02}',            '[{"id":"dev-b1c2d3","os":"Android","browser":"Firefox Mobile","last_seen":"2024-12-10"}]',                                                                    6.9),
  ('CUST-011', 'critical',   5500.00, 100000.00,'[{"country":"KP","city":"Pyongyang","frequency":0.80},{"country":"CN","city":"Dandong","frequency":0.20}]',         '{"weekday_peak":"00:00-04:00","weekend_peak":"00:00-06:00","night_activity":0.95}',            '[{"id":"dev-e4f5g6","os":"Unknown","browser":"Unknown","last_seen":"2024-12-10"}]',                                                                            99.9),
  ('CUST-012', 'spending',   525.00,  8000.00,  '[{"country":"US","city":"Miami","frequency":0.70},{"country":"US","city":"Orlando","frequency":0.30}]',             '{"weekday_peak":"14:00-17:00","weekend_peak":"11:00-15:00","night_activity":0.08}',            '[{"id":"dev-h7i8j9","os":"Windows","browser":"Chrome","last_seen":"2024-12-10"},{"id":"dev-phn003","os":"Android","browser":"Chrome Mobile","last_seen":"2024-12-08"}]',22.4),
  ('CUST-013', 'spending',   2750.00, 18000.00, '[{"country":"US","city":"Detroit","frequency":0.85},{"country":"US","city":"Cleveland","frequency":0.15}]',         '{"weekday_peak":"10:00-13:00","weekend_peak":"12:00-16:00","night_activity":0.10}',            '[{"id":"dev-k1l2m3","os":"macOS","browser":"Safari","last_seen":"2024-12-10"}]',                                                                              58.6),
  ('CUST-014', 'spending',   48.25,   600.00,   '[{"country":"US","city":"San Francisco","frequency":0.97},{"country":"US","city":"Oakland","frequency":0.03}]',     '{"weekday_peak":"07:30-09:00","weekend_peak":"09:00-11:00","night_activity":0.01}',            '[{"id":"dev-n4o5p6","os":"iOS","browser":"Safari","last_seen":"2024-12-10"}]',                                                                                2.4),
  ('CUST-015', 'high_risk',  6800.00, 45000.00, '[{"country":"IR","city":"Tehran","frequency":0.65},{"country":"TR","city":"Istanbul","frequency":0.35}]',           '{"weekday_peak":"01:00-03:00","weekend_peak":"02:00-05:00","night_activity":0.82}',            '[{"id":"dev-q7r8s9","os":"Windows","browser":"Tor","last_seen":"2024-12-10"}]',                                                                                98.7);

-- ============================================================
-- MERCHANT RISK PROFILES (15 profiles)
-- ============================================================
INSERT INTO merchant_risk_profiles (merchant_name, merchant_category, risk_score, chargeback_rate, fraud_incident_count, avg_transaction_amount, country, is_flagged) VALUES
  ('Amazon',              'retail',           5.2,  0.0012, 3,   78.50,   'US', FALSE),
  ('CryptoSwap Exchange', 'crypto_exchange',  92.7, 0.1834, 142, 4250.00, 'NG', TRUE),
  ('Best Buy',            'electronics',      8.4,  0.0089, 7,   312.00,  'US', FALSE),
  ('Luxury Jewelers Inc', 'jewelry',          61.3, 0.0445, 38,  3800.00, 'GB', TRUE),
  ('Netflix',             'streaming',        2.1,  0.0008, 1,   15.99,   'US', FALSE),
  ('Gaming Palace Casino','gambling',         78.9, 0.0923, 87,  850.00,  'GB', TRUE),
  ('Shell Gas Station',   'fuel',             7.2,  0.0034, 4,   65.00,   'US', FALSE),
  ('Apple Store',         'electronics',      15.6, 0.0121, 22,  785.00,  'US', FALSE),
  ('Delta Airlines',      'travel',           12.8, 0.0098, 11,  425.00,  'US', FALSE),
  ('FastCash Wire',       'wire_transfer',    97.4, 0.2341, 204, 5600.00, 'RU', TRUE),
  ('Marriott Hotels',     'hotel',            11.4, 0.0076, 9,   580.00,  'US', FALSE),
  ('AutoTrader',          'automotive',       45.7, 0.0312, 29,  2900.00, 'US', FALSE),
  ('Starbucks',           'food_beverage',    3.8,  0.0015, 2,   8.75,    'US', FALSE),
  ('GoldBars Direct',     'precious_metals',  89.2, 0.1567, 118, 12400.00,'IR', TRUE),
  ('Target',              'retail',           6.1,  0.0028, 5,   110.00,  'US', FALSE);

COMMIT;
