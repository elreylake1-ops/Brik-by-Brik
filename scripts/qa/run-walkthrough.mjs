const base = 'http://localhost:3000';
const dealId = 'deal-wp4b-live-01';
const asmtId = 'asmt-wp4b-live-01';

// 1. Initial State Check
console.log('--- Step 1: Initial Refurb Plan State ---');
const r1 = await fetch(`${base}/api/saved-deals/${dealId}/viewing-assessments/${asmtId}/refurb-plan`);
const j1 = await r1.json();
console.log('Refurb plan loaded, items count:', j1.proposal?.items?.length);
console.log('Overrides count (initial):', j1.quoteOverrides?.length);

// 2. Approve Contractor Quote: £3,500 for Bathroom
console.log('--- Step 2: Approving Contractor Quote (£3,500) ---');
const r2 = await fetch(`${base}/api/saved-deals/${dealId}/viewing-assessments/${asmtId}/quote-overrides`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    itemId: 'bathroom',
    taskId: 'bathroom-partial-unsupported',
    quoteRef: 'Apex Contractors APX-3500',
    quoteEvidenceId: 'ev-quote-apex-01',
    approvedAmount: 3500,
    vatBasis: 'GROSS'
  })
});
console.log('Quote approval status:', r2.status);
const j2 = await r2.json();
console.log('Quote approved:', j2.override?.quoteRef, 'Amount:', j2.override?.approvedAmount, 'Type:', j2.override?.quoteType);

// 3. Verify Persistence on Reload
console.log('--- Step 3: Refreshing / Reloading Page ---');
const r3 = await fetch(`${base}/saved-deals/${dealId}/viewing?assessment=${asmtId}`);
const html3 = await r3.text();
console.log('Page reload status:', r3.status);
console.log('Contains Verified contractor quote:', html3.includes('Verified contractor quote:'));
console.log('Contains £3,500.00:', html3.includes('£3,500.00'));
console.log('Contains Apex Contractors APX-3500:', html3.includes('Apex Contractors APX-3500'));
console.log('Contains Supersede quote button:', html3.includes('Supersede quote'));

// 4. Save Measurements & Preview Scope
console.log('--- Step 4: Previewing Scope with Kitchen Unpriced ---');
const r4 = await fetch(`${base}/api/saved-deals/${dealId}/viewing-assessments/${asmtId}/refurb-plan/preview`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accepted: [{ itemId: 'bathroom' }, { itemId: 'kitchen' }],
    propertyBasics: { bedrooms: 3, bathrooms: 1, kitchenSize: 'medium', floorAreaSqm: 120 },
    financialAssumptions: { stampDuty: 22500, legalCosts: 3500, saleCosts: 9000, bridgeTermMonths: 9 }
  })
});
const j4 = await r4.json();
console.log('Preview estimate status:', j4.computation?.estimate?.status);
console.log('Total refurb cost:', j4.computation?.estimate?.totalRefurbCost);
console.log('Unpriced items:', j4.computation?.estimate?.unpricedItems?.map(u => u.label));

// 5. Supersede Quote with £3,800 (Rev-B)
console.log('--- Step 5: Superseding Quote with £3,800 ---');
const r5 = await fetch(`${base}/api/saved-deals/${dealId}/viewing-assessments/${asmtId}/quote-overrides`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    itemId: 'bathroom',
    taskId: 'bathroom-partial-unsupported',
    quoteRef: 'Apex Contractors Rev-B',
    quoteEvidenceId: 'ev-quote-apex-01',
    approvedAmount: 3800,
    vatBasis: 'GROSS'
  })
});
const j5 = await r5.json();
console.log('Revised quote approved:', j5.override?.quoteRef, 'Amount:', j5.override?.approvedAmount);

// 6. Verify Audit Trail in Stored Records
console.log('--- Step 6: Verifying Audit Trail in Database ---');
const r6 = await fetch(`${base}/api/saved-deals/${dealId}/viewing-assessments/${asmtId}/quote-overrides`);
const j6 = await r6.json();
console.log('Overrides in audit trail:', j6.overrides.map(o => ({
  ref: o.quoteRef,
  amount: o.approvedAmount,
  status: o.status,
  supersededBy: o.supersededBy
})));

// 6b. Confirm Scope to generate Builder Pack
console.log('--- Step 6b: Confirming Scope for Builder Pack ---');
const rConfirm = await fetch(`${base}/api/saved-deals/${dealId}/viewing-assessments/${asmtId}/refurb-plan`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    idempotencyKey: 'idemp-confirm-demo-01',
    expectedFingerprint: j1.proposal.fingerprint,
    accepted: [{ itemId: 'bathroom' }],
    propertyBasics: { bedrooms: 3, bathrooms: 1, kitchenSize: 'medium', floorAreaSqm: 120 },
    financialAssumptions: { stampDuty: 22500, legalCosts: 3500, saleCosts: 9000, bridgeTermMonths: 9 }
  })
});
const jConfirm = await rConfirm.json();
console.log('Plan confirmed:', jConfirm.success, 'version:', jConfirm.plan?.planVersion, 'errors:', jConfirm.errors);

// 7. Verify Builder Pack and Deal Passport
console.log('--- Step 7: Verifying Builder Pack & Deal Passport Routes ---');
const r7 = await fetch(`${base}/saved-deals/${dealId}/builder-pack?assessmentId=${asmtId}`);
console.log('Builder pack status:', r7.status);
const r8 = await fetch(`${base}/saved-deals/${dealId}/passport?assessmentId=${asmtId}`);
console.log('Deal passport status:', r8.status);

// 8. Verify Saved Deal Immutability
console.log('--- Step 8: Verifying Original Saved Deal Immutability ---');
const r9 = await fetch(`${base}/api/saved-deals/${dealId}`);
const j9 = await r9.json();
console.log('Saved Deal original refurb cost:', j9.deal?.refurb_cost);
console.log('Saved Deal original purchase price:', j9.deal?.purchase_price);
console.log('Saved Deal status:', j9.deal?.governance_state);
