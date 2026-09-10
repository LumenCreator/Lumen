/* Lumen Terminal — Main Street: what households actually spend money on, and who gets paid.
 *
 * Two datasets:
 *   BASKET    — household cost categories, their share of spend, and the listed companies on
 *               the receiving end of each. This is the "what are ordinary people worried
 *               about" layer, and it is what turns a cost-of-living headline into a ticker.
 *   PLAYBOOKS — disaster response chains. A catastrophe is not one trade, it is a sequence:
 *               emergency response, then claims, then materials, then vehicles, then
 *               infrastructure — each phase with a different set of companies and a different
 *               window. The phase timings are how these events have typically unfolded, not
 *               guarantees.
 *
 * Cost shares are approximate, drawn from the shape of ABS/ONS/BLS household expenditure
 * surveys rather than any single release. They are here to order the categories sensibly, not
 * to be quoted as statistics.
 */
(function (global) {
  'use strict';

  /* ---------- regional companies referenced below ---------- */
  /* Registered into UNIVERSE so they chart, quote and link like any other name. */
  var COMPANIES = [
    /* Australia — building materials and construction */
    { t: 'JHX.AX', n: 'James Hardie', c: 'AU', sector: 'mining', mcap: 2.2e10, note: 'Fibre cement cladding — the dominant exterior wall product in AU rebuilds' },
    { t: 'BLD.AX', n: 'Boral', c: 'AU', sector: 'mining', mcap: 7.0e9, note: 'Concrete, aggregates, asphalt' },
    { t: 'ABC.AX', n: 'Adbri', n2: 'Adbri (cement)', c: 'AU', sector: 'mining', mcap: 2.0e9, note: 'Cement and lime — the input under every slab' },
    { t: 'BKW.AX', n: 'Brickworks', c: 'AU', sector: 'mining', mcap: 4.5e9, note: 'Bricks and Bristile Roofing — roof tiles specifically' },
    { t: 'CSR.AX', n: 'CSR', c: 'AU', sector: 'mining', mcap: 4.0e9, note: 'Gyprock plasterboard, insulation — every internal wall' },
    { t: 'BSL.AX', n: 'BlueScope Steel', c: 'AU', sector: 'mining', mcap: 1.0e10, note: 'Colorbond roofing steel — the other half of AU roofs' },
    { t: 'JLG.AX', n: 'Johns Lyng Group', c: 'AU', sector: 'shipping', mcap: 1.5e9, note: 'Insurance building and restoration — the contractor that mobilises first after a catastrophe' },
    { t: 'REH.AX', n: 'Reece', c: 'AU', sector: 'consumer', mcap: 1.6e10, note: 'Plumbing and bathroom supply' },
    { t: 'RWC.AX', n: 'Reliance Worldwide', c: 'AU', sector: 'mining', mcap: 3.5e9, note: 'Plumbing fittings (SharkBite)' },
    { t: 'GWA.AX', n: 'GWA Group', c: 'AU', sector: 'consumer', mcap: 6.0e8, note: 'Bathroom and kitchen fixtures' },
    { t: 'WES.AX', n: 'Wesfarmers', c: 'AU', sector: 'consumer', mcap: 8.0e10, note: 'Bunnings — where owner-rebuilders and trades actually buy' },
    { t: 'FBU.AX', n: 'Fletcher Building', c: 'NZ', sector: 'mining', mcap: 2.0e9, note: 'NZ/AU materials and construction' },
    { t: 'WGN.AX', n: 'Wagners', c: 'AU', sector: 'mining', mcap: 3.0e8, note: 'Cement, composite fibre infrastructure' },
    /* Australia — insurance, the phase that pays for it */
    { t: 'IAG.AX', n: 'Insurance Australia Group', c: 'AU', sector: 'banks', mcap: 1.8e10, note: 'NRMA/CGU — largest AU home insurer; catastrophe losses land here first' },
    { t: 'SUN.AX', n: 'Suncorp', c: 'AU', sector: 'banks', mcap: 2.2e10, note: 'AAMI/GIO — home and motor exposure to natural hazard' },
    { t: 'QBE.AX', n: 'QBE Insurance', c: 'AU', sector: 'banks', mcap: 2.6e10, note: 'Global commercial lines and reinsurance recoveries' },
    /* Australia — banks, energy, retail, telco, healthcare */
    { t: 'CBA.AX', n: 'Commonwealth Bank', c: 'AU', sector: 'banks', mcap: 1.9e11, note: 'Largest mortgage book in the country — the rent/mortgage line' },
    { t: 'WBC.AX', n: 'Westpac', c: 'AU', sector: 'banks', mcap: 1.1e11, note: 'Mortgages and business lending' },
    { t: 'AGL.AX', n: 'AGL Energy', c: 'AU', sector: 'utilities', mcap: 7.0e9, note: 'Retail electricity and gas — the power bill' },
    { t: 'ORG.AX', n: 'Origin Energy', c: 'AU', sector: 'utilities', mcap: 1.7e10, note: 'Energy retail plus LNG' },
    { t: 'ALD.AX', n: 'Ampol', c: 'AU', sector: 'energy', mcap: 6.0e9, note: 'Fuel refining and retail — the price on the forecourt sign' },
    { t: 'WOW.AX', n: 'Woolworths', c: 'AU', sector: 'consumer', mcap: 4.0e10, note: 'Groceries — the weekly shop' },
    { t: 'COL.AX', n: 'Coles', c: 'AU', sector: 'consumer', mcap: 2.6e10, note: 'Groceries' },
    { t: 'TLS.AX', n: 'Telstra', c: 'AU', sector: 'tech', mcap: 4.5e10, note: 'Telecoms — network restoration after disasters' },
    { t: 'TCL.AX', n: 'Transurban', c: 'AU', sector: 'shipping', mcap: 4.2e10, note: 'Toll roads — transport cost and infrastructure repair' },
    { t: 'DOW.AX', n: 'Downer EDI', c: 'AU', sector: 'shipping', mcap: 3.0e9, note: 'Infrastructure services and government maintenance contracts' },
    { t: 'SVW.AX', n: 'Seven Group', c: 'AU', sector: 'mining', mcap: 1.5e10, note: 'Coates hire and Boral stake — equipment for every rebuild' },
    { t: 'MND.AX', n: 'Monadelphous', c: 'AU', sector: 'shipping', mcap: 1.4e9, note: 'Engineering construction and maintenance' },
    { t: 'CWY.AX', n: 'Cleanaway', c: 'AU', sector: 'utilities', mcap: 6.0e9, note: 'Waste — debris clearance is the first physical job after a disaster' },
    { t: 'APE.AX', n: 'Eagers Automotive', c: 'AU', sector: 'autos', mcap: 3.5e9, note: 'Car dealer — replacement vehicles after write-offs' },
    { t: 'BAP.AX', n: 'Bapcor', c: 'AU', sector: 'autos', mcap: 1.6e9, note: 'Vehicle parts and service' },
    { t: 'RHC.AX', n: 'Ramsay Health Care', c: 'AU', sector: 'health', mcap: 1.0e10, note: 'Private hospitals — surge demand and staffing costs' },
    { t: 'MPL.AX', n: 'Medibank', c: 'AU', sector: 'health', mcap: 1.1e10, note: 'Private health insurance premiums' },
    /* United States / global equivalents so the playbooks work outside AU */
    { t: 'HD', n: 'Home Depot', c: 'US', sector: 'consumer', mcap: 3.5e11, note: 'US building materials retail' },
    { t: 'LOW', n: "Lowe's", c: 'US', sector: 'consumer', mcap: 1.4e11, note: 'US home improvement' },
    { t: 'BLDR', n: 'Builders FirstSource', c: 'US', sector: 'mining', mcap: 1.7e10, note: 'US structural building products' },
    { t: 'MAS', n: 'Masco', c: 'US', sector: 'consumer', mcap: 1.6e10, note: 'Plumbing and coatings' },
    { t: 'OC', n: 'Owens Corning', c: 'US', sector: 'mining', mcap: 1.5e10, note: 'Roofing shingles and insulation — the US roof line' },
    { t: 'VMC', n: 'Vulcan Materials', c: 'US', sector: 'mining', mcap: 3.4e10, note: 'Aggregates for road and infrastructure repair' },
    { t: 'MLM', n: 'Martin Marietta', c: 'US', sector: 'mining', mcap: 3.2e10, note: 'Aggregates and cement' },
    { t: 'CRH', n: 'CRH', c: 'IE', sector: 'mining', mcap: 6.0e10, note: 'Global building materials and road infrastructure' },
    { t: 'PWR', n: 'Quanta Services', c: 'US', sector: 'battery', mcap: 4.5e10, note: 'Grid restoration after storms' },
    { t: 'GNRC', n: 'Generac', c: 'US', sector: 'battery', mcap: 9.0e9, note: 'Home standby generators — demand spikes on outage events' },
    { t: 'TT', n: 'Trane Technologies', c: 'US', sector: 'consumer', mcap: 8.0e10, note: 'HVAC — heat events and rebuilds' },
    { t: 'ALL', n: 'Allstate', c: 'US', sector: 'banks', mcap: 5.0e10, note: 'US home and motor insurer — catastrophe loss exposure' },
    { t: 'TRV', n: 'Travelers', c: 'US', sector: 'banks', mcap: 5.5e10, note: 'US property casualty' },
    { t: 'RNR', n: 'RenaissanceRe', c: 'BM', sector: 'banks', mcap: 1.2e10, note: 'Reinsurance — pricing hardens after a large catastrophe year' },
    { t: 'MUV2.DE', n: 'Munich Re', c: 'DE', sector: 'banks', mcap: 6.5e10, note: 'Global reinsurer; catastrophe pricing bellwether' },
    { t: 'CPRT', n: 'Copart', c: 'US', sector: 'autos', mcap: 5.0e10, note: 'Salvage auctions — flood write-offs flow through here' },
    { t: 'WM', n: 'Waste Management', c: 'US', sector: 'utilities', mcap: 8.5e10, note: 'Debris removal at scale' },
    { t: 'AWK', n: 'American Water Works', c: 'US', sector: 'utilities', mcap: 2.7e10, note: 'Water infrastructure repair' },
    { t: 'URI', n: 'United Rentals', c: 'US', sector: 'mining', mcap: 5.0e10, note: 'Equipment rental — the fleet every rebuild hires' }
  ];

  /* ---------- household cost basket ---------- */
  /* share: rough proportion of a household budget. sens: which macro factor moves this line.
     dir: +1 means the cost rises when that factor rises. */
  var BASKET = [
    {
      id: 'housing', n: 'Mortgage & rent', icon: '🏠', share: 0.24, sens: 'rates', dir: 1,
      pain: 'The single largest and most rate-sensitive line. A 1% move in the mortgage rate outweighs almost anything else on this list.',
      proxy: 'US10Y',
      winners: [{ t: 'CBA.AX', w: 'Net interest margin widens before arrears catch up' }, { t: 'WBC.AX', w: 'Same mechanism' }, { t: 'JPM', w: 'US equivalent' }],
      losers: [{ t: 'HD', w: 'Renovation spend is credit financed' }, { t: 'WES.AX', w: 'Bunnings discretionary DIY slows' }]
    },
    {
      id: 'energy', n: 'Electricity & gas', icon: '⚡', share: 0.05, sens: 'oil', dir: 1,
      pain: 'The most visible bill and the fastest to become political. Wholesale power follows gas, and retail resets lag it by two or three quarters.',
      proxy: 'NG=F',
      winners: [{ t: 'AGL.AX', w: 'Generation margin expands when wholesale rises' }, { t: 'ORG.AX', w: 'Integrated retail plus LNG' }, { t: 'VST', w: 'US merchant power' }],
      losers: [{ t: 'AA', w: 'Aluminium smelting is a power price in disguise' }, { t: 'CSR.AX', w: 'Energy-intensive materials manufacture' }]
    },
    {
      id: 'fuel', n: 'Petrol & transport', icon: '⛽', share: 0.11, sens: 'oil', dir: 1,
      pain: 'Non-discretionary for anyone who commutes. The forecourt price is where an oil shock stops being abstract.',
      proxy: 'CL=F',
      winners: [{ t: 'ALD.AX', w: 'Refining and retail margin' }, { t: 'XOM', w: 'Integrated producer' }, { t: 'TCL.AX', w: 'Toll volumes are resilient' }],
      losers: [{ t: 'DAL', w: 'Jet fuel is a quarter of airline opex' }, { t: 'APE.AX', w: 'Large-vehicle demand falls' }]
    },
    {
      id: 'groceries', n: 'Groceries', icon: '🛒', share: 0.17, sens: 'inflation', dir: 1,
      pain: 'Where inflation is felt weekly. Supermarkets keep margin through private label while volumes trade down.',
      proxy: 'ZW=F',
      winners: [{ t: 'WOW.AX', w: 'Scale and private label protect margin' }, { t: 'COL.AX', w: 'Same' }, { t: 'COST', w: 'Trade-down beneficiary' }],
      losers: [{ t: 'MCD', w: 'Input costs before pricing catches up' }, { t: 'TSN', w: 'Feed costs squeeze protein margins' }]
    },
    {
      id: 'insurance', n: 'Home & car insurance', icon: '📋', share: 0.05, sens: 'war', dir: 1,
      pain: 'Premiums are repriced after every catastrophe season, and in hazard-exposed areas cover is becoming unavailable at any price.',
      proxy: 'GC=F',
      winners: [{ t: 'IAG.AX', w: 'Premium rate increases stick after a loss year' }, { t: 'SUN.AX', w: 'Same' }, { t: 'MUV2.DE', w: 'Reinsurance pricing hardens' }],
      losers: [{ t: 'QBE.AX', w: 'Until repricing catches up, claims land first' }, { t: 'ALL', w: 'US catastrophe exposure' }]
    },
    {
      id: 'repairs', n: 'Home repairs & materials', icon: '🧱', share: 0.06, sens: 'inflation', dir: 1,
      pain: 'Roofing, plumbing and trades. Costs are labour-constrained more than material-constrained — a shortage of tradespeople sets the price.',
      proxy: 'HG=F',
      winners: [{ t: 'BKW.AX', w: 'Bricks and roof tiles' }, { t: 'JHX.AX', w: 'Cladding' }, { t: 'REH.AX', w: 'Plumbing supply' }, { t: 'OC', w: 'US roofing' }],
      losers: [{ t: 'CBA.AX', w: 'Renovation lending slows when quotes blow out' }]
    },
    {
      id: 'health', n: 'Health & care', icon: '⚕', share: 0.06, sens: 'consumer', dir: -1,
      pain: 'Gap fees and premium rises. The first thing households downgrade and the last thing they can afford to.',
      proxy: 'SPY',
      winners: [{ t: 'MPL.AX', w: 'Premium increases are regulated but granted' }, { t: 'RHC.AX', w: 'Private surgical demand' }, { t: 'UNH', w: 'US equivalent' }],
      losers: []
    },
    {
      id: 'telco', n: 'Phone & internet', icon: '📶', share: 0.03, sens: 'consumer', dir: -1,
      pain: 'Small in dollars, but one of the few bills a household can actually switch, so it is a good early read on stress.',
      proxy: 'SPY',
      winners: [{ t: 'TLS.AX', w: 'Pricing power on the incumbent network' }],
      losers: []
    },
    {
      id: 'vehicle', n: 'Car purchase & servicing', icon: '🚗', share: 0.09, sens: 'rates', dir: 1,
      pain: 'Almost entirely credit financed. New-vehicle demand is a direct read on how households feel about the next three years.',
      proxy: 'US10Y',
      winners: [{ t: 'BAP.AX', w: 'People service the old car instead of replacing it' }, { t: 'CPRT', w: 'Salvage volumes' }],
      losers: [{ t: 'APE.AX', w: 'New vehicle finance dries up' }, { t: 'F', w: 'Same' }, { t: 'GM', w: 'Same' }]
    },
    {
      id: 'discretionary', n: 'Eating out, travel, leisure', icon: '🍽', share: 0.14, sens: 'consumer', dir: -1,
      pain: 'The shock absorber. This is the line that gets cut first, which is why it leads the consumer cycle rather than following it.',
      proxy: 'SPY',
      winners: [{ t: 'WOW.AX', w: 'Spend shifts from restaurant to retail' }],
      losers: [{ t: 'BKNG', w: 'Discretionary travel is cancelled first' }, { t: 'CCL', w: 'Same' }, { t: 'MCD', w: 'Volume, though trade-down partly offsets' }]
    }
  ];

  /* ---------- disaster response playbooks ---------- */
  /* Phases run in sequence. `days` is the window each phase typically dominates. */
  var PLAYBOOKS = [
    {
      id: 'flood', n: 'Flood / storm surge', icon: '🌊',
      regions: ['AU', 'US', 'GB', 'DE', 'CN', 'IN'],
      note: 'The most expensive natural hazard in Australia by insured loss. Water damage writes off contents and vehicles far more readily than structures, which shifts the rebuild mix toward interiors and motor.',
      phases: [
        { id: 'p0', n: 'Emergency response', days: [0, 14],
          what: 'Evacuation, pumping, power and network restoration, debris clearance, temporary accommodation.',
          picks: { AU: ['JLG.AX', 'CWY.AX', 'TLS.AX', 'ALD.AX'], US: ['WM', 'PWR', 'GNRC', 'AWK'] } },
        { id: 'p1', n: 'Claims & assessment', days: [7, 90],
          what: 'Loss adjusters mobilise, insurers book catastrophe provisions, reinsurance attaches. Insurer share prices usually fall on the loss and recover on the repricing.',
          picks: { AU: ['IAG.AX', 'SUN.AX', 'QBE.AX', 'JLG.AX'], US: ['ALL', 'TRV', 'RNR', 'MUV2.DE'] },
          caution: 'Insurers are a loss in this phase and a beneficiary two quarters later. Direction depends entirely on where you are in that arc.' },
        { id: 'p2', n: 'Interior rebuild & materials', days: [30, 540],
          what: 'Plasterboard, flooring, electrical, plumbing, kitchens. Water damage concentrates spend inside the envelope rather than on the roof.',
          picks: { AU: ['CSR.AX', 'REH.AX', 'RWC.AX', 'GWA.AX', 'WES.AX', 'JHX.AX'], US: ['BLDR', 'MAS', 'HD', 'LOW'] } },
        { id: 'p3', n: 'Vehicle replacement', days: [21, 270],
          what: 'Flooded vehicles are written off almost without exception. Salvage volumes spike, then replacement demand follows.',
          picks: { AU: ['APE.AX', 'BAP.AX'], US: ['CPRT', 'F', 'GM'] } },
        { id: 'p4', n: 'Infrastructure & mitigation', days: [180, 1800],
          what: 'Roads, bridges, levees, drainage. Government funded, slow to award, multi-year revenue once it lands.',
          picks: { AU: ['DOW.AX', 'MND.AX', 'SVW.AX', 'WGN.AX', 'TCL.AX'], US: ['VMC', 'MLM', 'CRH', 'URI', 'PWR'] } }
      ]
    },
    {
      id: 'cyclone', n: 'Cyclone / hurricane', icon: '🌀',
      regions: ['AU', 'US', 'JP', 'PH', 'MX'],
      note: 'Wind damage attacks the roof and building envelope first. That makes it the classic roofing and cladding event — and roofing is exactly where a small number of listed suppliers dominate.',
      phases: [
        { id: 'p0', n: 'Emergency response', days: [0, 14],
          what: 'Power restoration is the binding constraint. Generators, line crews, tarping, emergency make-safe.',
          picks: { AU: ['JLG.AX', 'TLS.AX', 'CWY.AX'], US: ['PWR', 'GNRC', 'WM'] } },
        { id: 'p1', n: 'Claims & assessment', days: [7, 90],
          what: 'Catastrophe declared, reinsurance attaches, make-safe contractors are appointed before permanent repair.',
          picks: { AU: ['IAG.AX', 'SUN.AX', 'JLG.AX'], US: ['ALL', 'TRV', 'RNR'] },
          caution: 'Same insurer arc as flood: loss now, pricing power later.' },
        { id: 'p2', n: 'Roof & envelope rebuild', days: [30, 720],
          what: 'Roof tiles, roofing steel, cladding, insulation, guttering. The highest-value phase and the most supply-constrained.',
          picks: { AU: ['BKW.AX', 'BSL.AX', 'JHX.AX', 'CSR.AX', 'WES.AX'], US: ['OC', 'BLDR', 'HD'] },
          key: true },
        { id: 'p3', n: 'Vehicle & contents', days: [21, 270],
          what: 'Hail and debris write-offs, contents replacement.',
          picks: { AU: ['APE.AX', 'BAP.AX', 'WES.AX'], US: ['CPRT', 'HD'] } },
        { id: 'p4', n: 'Infrastructure hardening', days: [180, 1800],
          what: 'Undergrounding, grid hardening, building code upgrades, coastal works.',
          picks: { AU: ['DOW.AX', 'SVW.AX', 'MND.AX'], US: ['PWR', 'VMC', 'MLM', 'URI'] } }
      ]
    },
    {
      id: 'bushfire', n: 'Bushfire / wildfire', icon: '🔥',
      regions: ['AU', 'US', 'CA', 'ES', 'GR'],
      note: 'Total losses rather than partial damage. That means full structural rebuilds from the slab up, so the spend runs across every material category at once — and it runs for years, not months.',
      phases: [
        { id: 'p0', n: 'Emergency response', days: [0, 21],
          what: 'Aerial firefighting, evacuation, power and telecom restoration, air quality and health response.',
          picks: { AU: ['JLG.AX', 'TLS.AX', 'RHC.AX', 'CWY.AX'], US: ['PWR', 'GNRC', 'WM'] } },
        { id: 'p1', n: 'Claims & total-loss assessment', days: [14, 120],
          what: 'Total losses settle faster than partial damage but at much larger individual sums.',
          picks: { AU: ['IAG.AX', 'SUN.AX', 'QBE.AX'], US: ['ALL', 'TRV', 'MUV2.DE'] },
          caution: 'Utilities can carry ignition liability. Check whether the network operator is implicated before treating power as a beneficiary.' },
        { id: 'p2', n: 'Full structural rebuild', days: [90, 1440],
          what: 'Slab, frame, roof, cladding, fit-out. Every category at once, constrained by trade availability rather than materials.',
          picks: { AU: ['BKW.AX', 'JHX.AX', 'CSR.AX', 'BLD.AX', 'ABC.AX', 'BSL.AX', 'WES.AX', 'REH.AX'], US: ['BLDR', 'OC', 'MAS', 'HD', 'VMC'] },
          key: true },
        { id: 'p3', n: 'Equipment & labour capacity', days: [60, 900],
          what: 'Plant hire, scaffolding, site services — the bottleneck resource in any large rebuild.',
          picks: { AU: ['SVW.AX', 'MND.AX'], US: ['URI'] } },
        { id: 'p4', n: 'Resilience & land use', days: [365, 2160],
          what: 'Building code changes, buy-backs, vegetation management, grid undergrounding.',
          picks: { AU: ['DOW.AX', 'WGN.AX'], US: ['PWR', 'CRH'] } }
      ]
    },
    {
      id: 'quake', n: 'Earthquake / tsunami', icon: '🌐',
      regions: ['JP', 'NZ', 'ID', 'TR', 'CL', 'US'],
      note: 'Structural rather than cosmetic. Insurance penetration varies enormously by country, and where it is low the rebuild is government funded and much slower to start.',
      phases: [
        { id: 'p0', n: 'Search, rescue & utilities', days: [0, 21],
          what: 'Water, power and telecom restoration, temporary shelter, medical surge.',
          picks: { AU: ['JLG.AX', 'CWY.AX', 'RHC.AX'], US: ['PWR', 'AWK', 'GNRC', 'WM'] } },
        { id: 'p1', n: 'Structural assessment', days: [14, 180],
          what: 'Engineering assessment, demolition orders, cordons. Slower than wind or water events because condemnation decisions take time.',
          picks: { AU: ['DOW.AX', 'MND.AX', 'IAG.AX'], US: ['TRV', 'RNR', 'MUV2.DE'] } },
        { id: 'p2', n: 'Demolition & structural rebuild', days: [180, 2160],
          what: 'Cement, aggregates, structural steel, seismic retrofit. The longest and most capital-intensive rebuild of any hazard type.',
          picks: { AU: ['ABC.AX', 'BLD.AX', 'BSL.AX', 'FBU.AX', 'SVW.AX'], US: ['VMC', 'MLM', 'CRH', 'URI'] },
          key: true },
        { id: 'p3', n: 'Infrastructure reconstruction', days: [365, 3600],
          what: 'Ports, rail, roads, water. Sovereign-funded programmes that run for a decade.',
          picks: { AU: ['DOW.AX', 'MND.AX', 'WGN.AX', 'TCL.AX'], US: ['VMC', 'MLM', 'PWR', 'CRH'] } }
      ]
    },
    {
      id: 'drought', n: 'Drought / heatwave', icon: '☀',
      regions: ['AU', 'US', 'IN', 'BR', 'ES'],
      note: 'Slow onset, so there is no single event date to trade around. It shows up as agricultural downgrades, power demand records and water restrictions months before it is called a disaster.',
      phases: [
        { id: 'p0', n: 'Grid & water stress', days: [0, 120],
          what: 'Record power demand, grid alerts, water restrictions, cooling equipment demand.',
          picks: { AU: ['AGL.AX', 'ORG.AX'], US: ['VST', 'CEG', 'GNRC', 'TT', 'AWK'] } },
        { id: 'p1', n: 'Agricultural downgrade', days: [30, 365],
          what: 'Yield forecasts cut, herd liquidation, feed costs rise, fertiliser demand falls.',
          picks: { AU: ['WOW.AX', 'COL.AX'], US: ['ADM', 'BG', 'TSN', 'CF'] },
          caution: 'Growers and processors move in opposite directions here. A yield cut lifts grain prices and squeezes anyone who buys grain.' },
        { id: 'p2', n: 'Food price pass-through', days: [90, 540],
          what: 'Retail food inflation, then political response — price monitoring, subsidies, export restrictions.',
          picks: { AU: ['WOW.AX', 'COL.AX'], US: ['COST', 'WMT'] } },
        { id: 'p3', n: 'Water infrastructure', days: [365, 2160],
          what: 'Desalination, pipelines, storage, irrigation efficiency.',
          picks: { AU: ['DOW.AX', 'MND.AX'], US: ['AWK', 'VMC'] } }
      ]
    }
  ];

  function playbook(id) {
    for (var i = 0; i < PLAYBOOKS.length; i++) if (PLAYBOOKS[i].id === id) return PLAYBOOKS[i];
    return null;
  }
  function basketItem(id) {
    for (var i = 0; i < BASKET.length; i++) if (BASKET[i].id === id) return BASKET[i];
    return null;
  }

  /* Build a ranked buy list for one playbook, for a country, at a point in the timeline. */
  function buildList(pbId, country, dayOffset) {
    var pb = playbook(pbId);
    if (!pb) return null;
    var day = dayOffset === undefined ? 7 : dayOffset;
    var region = country === 'AU' || country === 'NZ' ? 'AU' : 'US';
    var rows = [], seen = {};
    pb.phases.forEach(function (ph) {
      var picks = ph.picks[region] || ph.picks.US || [];
      /* how live is this phase right now */
      var active = day >= ph.days[0] && day <= ph.days[1];
      var upcoming = day < ph.days[0];
      var timing = active ? 1 : upcoming ? Math.max(0.15, 1 - (ph.days[0] - day) / 365) : Math.max(0.05, 1 - (day - ph.days[1]) / 540);
      picks.forEach(function (t, i) {
        var key = t;
        var rank = (ph.key ? 1.25 : 1) * timing * (1 - i * 0.06);
        if (seen[key]) {
          if (rank > seen[key].score) { seen[key].score = rank; seen[key].phase = ph; seen[key].active = active; }
          seen[key].phases.push(ph.n);
          return;
        }
        var rec = { t: t, score: rank, phase: ph, active: active, upcoming: upcoming, phases: [ph.n] };
        seen[key] = rec;
        rows.push(rec);
      });
    });
    rows.sort(function (a, b) { return b.score - a.score; });
    return { playbook: pb, region: region, day: day, rows: rows };
  }

  global.HOUSEHOLD = {
    COMPANIES: COMPANIES, BASKET: BASKET, PLAYBOOKS: PLAYBOOKS,
    playbook: playbook, basketItem: basketItem, buildList: buildList
  };

  if (global.UNIVERSE && global.UNIVERSE.registerCompanies) {
    global.UNIVERSE.registerCompanies(COMPANIES);
  }
})(window);
