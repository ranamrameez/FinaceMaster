# FinaceMaster

FinanceManager live link:
<https://ranamrameez.github.io/FinaceMaster/>

## Updates Pending

1. QSE: save H1 EPS data on db rather hard coding. also, check other data as well and make sure no data is hard coded. you may general stock data in their own node rather than belonging to 1 user. 
2. Save multiple selling plan in db.
3. QSE numbers in calculation are 4 digits (2.155 , 21.55)

4. we have multiple pages now. we must treat it as website rather single pages. centralized css, js, logos. separate js for apis. all data syncing to our firebase db.

5. PSX: JS Bank charges sheet lists CGT at 15% for filers but 30% for non-filers — the app currently defaults both to 15%.
6. PSX: Currently app is applying fees without realizing same day trade one leg charges only.
7. PSX: app should auto check, and show both, if share is sold same or after that day to calculate commission based fees. with the manual checkbox as well for same day trade recording. All calculators must show, break-even and all other calculations for shares sold same day or after.
8. PSX: each buy should have its own sell peer (on sold). only then we can truly adjust and control(manually, if needed) share selling commission.

-------- -----------

# Migration Plan Overview 

## Migration from plain HTML FinanceMaster app to React JS FinanceRecorder app

### App Name: FinanceRecorder

### Plan

Include each and evrything from our FinanceMaster app.
Develop FinanceGuru app which will be React JS based. All shared components should be extracted developed separately. Then we can have Specialized components for each Stock Exchange. User can switch between Exchanges to view and modify his portfolio. For both PSX and QSE we have real trade data to verify our formulas and calculations.
