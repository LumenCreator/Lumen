/* Lumen Terminal — reference universe.
   Static reference values (market caps, exposures, weights) are approximations used to seed
   models and the demo dataset. In LIVE mode quotes/caps are overwritten by the data providers. */
(function (global) {
  'use strict';

  /* ---------- regions ---------- */
  var REGIONS = {
    NAM: 'North America', LATAM: 'Latin America', EU: 'Europe', UK: 'United Kingdom',
    MENA: 'Middle East & N. Africa', AFR: 'Sub-Saharan Africa', EEU: 'Eastern Europe & Russia',
    SAS: 'South Asia', EAS: 'East Asia', SEA: 'Southeast Asia', OCE: 'Oceania'
  };

  /* ---------- countries: capital coords, region, market weight, exports ---------- */
  /* w = geopolitical/financial weight 0..1, drives baseline map luminance */
  var COUNTRIES = {
    US: { n: 'United States', r: 'NAM', ll: [38.9, -77.0], w: 1.00, ex: ['tech', 'defense', 'lng', 'agri', 'finance'], idx: 'SPX' },
    CA: { n: 'Canada', r: 'NAM', ll: [45.4, -75.7], w: 0.42, ex: ['crude', 'potash', 'lumber', 'uranium'], idx: 'TSX' },
    MX: { n: 'Mexico', r: 'LATAM', ll: [19.4, -99.1], w: 0.34, ex: ['autos', 'crude', 'agri'], idx: 'MEXBOL' },
    BR: { n: 'Brazil', r: 'LATAM', ll: [-15.8, -47.9], w: 0.40, ex: ['iron', 'soy', 'crude', 'beef'], idx: 'IBOV' },
    AR: { n: 'Argentina', r: 'LATAM', ll: [-34.6, -58.4], w: 0.20, ex: ['soy', 'lithium', 'beef'], idx: 'MERVAL' },
    CL: { n: 'Chile', r: 'LATAM', ll: [-33.4, -70.7], w: 0.22, ex: ['copper', 'lithium'], idx: 'IPSA' },
    VE: { n: 'Venezuela', r: 'LATAM', ll: [10.5, -66.9], w: 0.16, ex: ['crude'], idx: null },
    GB: { n: 'United Kingdom', r: 'UK', ll: [51.5, -0.13], w: 0.68, ex: ['finance', 'pharma', 'defense'], idx: 'UKX' },
    DE: { n: 'Germany', r: 'EU', ll: [52.5, 13.4], w: 0.66, ex: ['autos', 'machinery', 'chemicals'], idx: 'DAX' },
    FR: { n: 'France', r: 'EU', ll: [48.9, 2.35], w: 0.60, ex: ['luxury', 'defense', 'nuclear', 'agri'], idx: 'CAC' },
    IT: { n: 'Italy', r: 'EU', ll: [41.9, 12.5], w: 0.44, ex: ['machinery', 'luxury'], idx: 'FTSEMIB' },
    ES: { n: 'Spain', r: 'EU', ll: [40.4, -3.7], w: 0.38, ex: ['autos', 'tourism', 'renewables'], idx: 'IBEX' },
    NL: { n: 'Netherlands', r: 'EU', ll: [52.4, 4.9], w: 0.46, ex: ['semicap', 'agri', 'logistics'], idx: 'AEX' },
    CH: { n: 'Switzerland', r: 'EU', ll: [46.9, 7.45], w: 0.48, ex: ['pharma', 'finance', 'commodities'], idx: 'SMI' },
    NO: { n: 'Norway', r: 'EU', ll: [59.9, 10.7], w: 0.30, ex: ['crude', 'gas', 'sovereign-fund'], idx: 'OBX' },
    SE: { n: 'Sweden', r: 'EU', ll: [59.3, 18.1], w: 0.28, ex: ['defense', 'telecom', 'iron'], idx: 'OMX' },
    PL: { n: 'Poland', r: 'EEU', ll: [52.2, 21.0], w: 0.26, ex: ['manufacturing', 'agri'], idx: 'WIG' },
    UA: { n: 'Ukraine', r: 'EEU', ll: [50.5, 30.5], w: 0.24, ex: ['wheat', 'corn', 'steel'], idx: null },
    RU: { n: 'Russia', r: 'EEU', ll: [55.8, 37.6], w: 0.62, ex: ['crude', 'gas', 'wheat', 'palladium', 'uranium'], idx: 'IMOEX' },
    TR: { n: 'Turkey', r: 'MENA', ll: [39.9, 32.9], w: 0.30, ex: ['manufacturing', 'defense', 'straits'], idx: 'XU100' },
    SA: { n: 'Saudi Arabia', r: 'MENA', ll: [24.7, 46.7], w: 0.58, ex: ['crude', 'petchem', 'sovereign-fund'], idx: 'TASI' },
    AE: { n: 'United Arab Emirates', r: 'MENA', ll: [24.5, 54.4], w: 0.44, ex: ['crude', 'logistics', 'finance'], idx: 'ADX' },
    QA: { n: 'Qatar', r: 'MENA', ll: [25.3, 51.5], w: 0.34, ex: ['lng'], idx: 'QSI' },
    KW: { n: 'Kuwait', r: 'MENA', ll: [29.4, 48.0], w: 0.22, ex: ['crude'], idx: null },
    IR: { n: 'Iran', r: 'MENA', ll: [35.7, 51.4], w: 0.46, ex: ['crude', 'hormuz'], idx: null },
    IQ: { n: 'Iraq', r: 'MENA', ll: [33.3, 44.4], w: 0.28, ex: ['crude'], idx: null },
    IL: { n: 'Israel', r: 'MENA', ll: [31.8, 35.2], w: 0.34, ex: ['defense', 'tech', 'gas'], idx: 'TA35' },
    EG: { n: 'Egypt', r: 'MENA', ll: [30.0, 31.2], w: 0.26, ex: ['suez', 'gas'], idx: 'EGX30' },
    DZ: { n: 'Algeria', r: 'MENA', ll: [36.7, 3.1], w: 0.18, ex: ['gas'], idx: null },
    LY: { n: 'Libya', r: 'MENA', ll: [32.9, 13.2], w: 0.16, ex: ['crude'], idx: null },
    NG: { n: 'Nigeria', r: 'AFR', ll: [9.06, 7.49], w: 0.22, ex: ['crude'], idx: 'NGX' },
    ZA: { n: 'South Africa', r: 'AFR', ll: [-25.7, 28.2], w: 0.24, ex: ['platinum', 'gold', 'coal'], idx: 'JALSH' },
    CD: { n: 'Dem. Rep. Congo', r: 'AFR', ll: [-4.32, 15.3], w: 0.20, ex: ['cobalt', 'copper'], idx: null },
    ET: { n: 'Ethiopia', r: 'AFR', ll: [9.03, 38.7], w: 0.10, ex: ['coffee'], idx: null },
    KE: { n: 'Kenya', r: 'AFR', ll: [-1.29, 36.8], w: 0.10, ex: ['agri'], idx: null },
    IN: { n: 'India', r: 'SAS', ll: [28.6, 77.2], w: 0.62, ex: ['services', 'refining', 'pharma', 'generics'], idx: 'NIFTY' },
    PK: { n: 'Pakistan', r: 'SAS', ll: [33.7, 73.1], w: 0.14, ex: ['textiles'], idx: null },
    CN: { n: 'China', r: 'EAS', ll: [39.9, 116.4], w: 0.92, ex: ['manufacturing', 'rare-earths', 'batteries', 'solar'], idx: 'SHCOMP' },
    JP: { n: 'Japan', r: 'EAS', ll: [35.7, 139.7], w: 0.66, ex: ['autos', 'semicap', 'robotics'], idx: 'NKY' },
    KR: { n: 'South Korea', r: 'EAS', ll: [37.6, 127.0], w: 0.54, ex: ['memory', 'shipbuilding', 'autos'], idx: 'KOSPI' },
    KP: { n: 'North Korea', r: 'EAS', ll: [39.0, 125.8], w: 0.14, ex: [], idx: null },
    TW: { n: 'Taiwan', r: 'EAS', ll: [25.0, 121.6], w: 0.70, ex: ['foundry', 'semis'], idx: 'TWSE' },
    HK: { n: 'Hong Kong', r: 'EAS', ll: [22.3, 114.2], w: 0.40, ex: ['finance'], idx: 'HSI' },
    SG: { n: 'Singapore', r: 'SEA', ll: [1.35, 103.8], w: 0.42, ex: ['finance', 'refining', 'shipping'], idx: 'STI' },
    ID: { n: 'Indonesia', r: 'SEA', ll: [-6.2, 106.8], w: 0.32, ex: ['nickel', 'coal', 'palm'], idx: 'JCI' },
    MY: { n: 'Malaysia', r: 'SEA', ll: [3.14, 101.7], w: 0.24, ex: ['semis-assembly', 'palm', 'lng'], idx: 'KLCI' },
    TH: { n: 'Thailand', r: 'SEA', ll: [13.8, 100.5], w: 0.22, ex: ['autos', 'agri'], idx: 'SET' },
    VN: { n: 'Vietnam', r: 'SEA', ll: [21.0, 105.8], w: 0.24, ex: ['electronics', 'textiles'], idx: 'VNINDEX' },
    PH: { n: 'Philippines', r: 'SEA', ll: [14.6, 121.0], w: 0.16, ex: ['nickel', 'bpo'], idx: 'PSEI' },
    AU: { n: 'Australia', r: 'OCE', ll: [-35.3, 149.1], w: 0.44, ex: ['iron', 'lng', 'lithium', 'coal'], idx: 'ASX' },
    NZ: { n: 'New Zealand', r: 'OCE', ll: [-41.3, 174.8], w: 0.14, ex: ['dairy'], idx: 'NZX' }
  };

  /* ---------- maritime / energy chokepoints ---------- */
  var CHOKEPOINTS = [
    { id: 'hormuz', n: 'Strait of Hormuz', ll: [26.6, 56.3], flow: '~20M bbl/d crude + 20% of LNG', at: ['IR', 'AE', 'SA', 'QA', 'KW', 'IQ'], sev: 1.0 },
    { id: 'suez', n: 'Suez Canal / Bab el-Mandeb', ll: [29.9, 32.55], flow: '~12% of global trade, 9M bbl/d', at: ['EG', 'SA', 'IL'], sev: 0.85 },
    { id: 'malacca', n: 'Strait of Malacca', ll: [2.5, 101.3], flow: '~16M bbl/d to East Asia', at: ['SG', 'MY', 'ID', 'CN', 'JP', 'KR'], sev: 0.9 },
    { id: 'taiwan', n: 'Taiwan Strait', ll: [24.5, 119.5], flow: '>50% of container traffic; 90% adv. logic', at: ['TW', 'CN', 'JP', 'KR', 'US'], sev: 1.0 },
    { id: 'bosphorus', n: 'Turkish Straits', ll: [41.1, 29.1], flow: 'Black Sea grain + Russian crude', at: ['TR', 'RU', 'UA'], sev: 0.6 },
    { id: 'panama', n: 'Panama Canal', ll: [9.08, -79.68], flow: '~5% of global trade, drought-sensitive', at: ['US', 'CL', 'BR'], sev: 0.55 },
    { id: 'danish', n: 'Danish Straits', ll: [55.7, 12.6], flow: 'Russian Baltic crude exports', at: ['RU', 'SE', 'DE'], sev: 0.45 },
    { id: 'gibraltar', n: 'Strait of Gibraltar', ll: [35.95, -5.6], flow: 'Atlantic–Med transit', at: ['ES', 'DZ'], sev: 0.35 }
  ];

  /* ---------- industries + global leaders ---------- */
  /* exp = exposure weights to macro factors, used by the cascade + risk engines:
     oil (crude price up), rates (yields up), usd (dollar up), war (conflict escalation),
     china (China demand/supply shock), consumer (consumer spend down), inflation (CPI up) */
  var INDUSTRIES = [
    {
      id: 'energy', n: 'Energy — Oil & Gas', icon: '⛽', color: '#b5761f',
      exp: { oil: 0.90, rates: -0.10, usd: -0.20, war: 0.55, china: 0.30, consumer: 0.05, inflation: 0.45 },
      leaders: [
        { t: 'XOM', n: 'Exxon Mobil', c: 'US', mcap: 5.2e11, note: 'Integrated major; Permian + Guyana' },
        { t: 'CVX', n: 'Chevron', c: 'US', mcap: 2.8e11, note: 'Integrated; Tengiz, Permian' },
        { t: 'SHEL', n: 'Shell', c: 'GB', mcap: 2.2e11, note: 'Largest LNG trader' },
        { t: 'TTE', n: 'TotalEnergies', c: 'FR', mcap: 1.5e11, note: 'LNG + Mideast concessions' },
        { t: '2222.SR', n: 'Saudi Aramco', c: 'SA', mcap: 1.8e12, note: 'Swing producer; spare capacity' },
        { t: 'PBR', n: 'Petrobras', c: 'BR', mcap: 9.0e10, note: 'Pre-salt deepwater' },
        { t: 'COP', n: 'ConocoPhillips', c: 'US', mcap: 1.3e11, note: 'US shale pure-play beta' },
        { t: 'SLB', n: 'SLB (Schlumberger)', c: 'US', mcap: 6.0e10, note: 'Oilfield services cycle' }
      ]
    },
    {
      id: 'defense', n: 'Defense & Aerospace', icon: '🛡', color: '#3d6d9e',
      exp: { oil: 0.10, rates: -0.05, usd: 0.05, war: 0.95, china: 0.25, consumer: -0.05, inflation: 0.10 },
      leaders: [
        { t: 'LMT', n: 'Lockheed Martin', c: 'US', mcap: 1.1e11, note: 'F-35, PAC-3 interceptors' },
        { t: 'RTX', n: 'RTX', c: 'US', mcap: 1.6e11, note: 'Missiles + engines; Patriot' },
        { t: 'NOC', n: 'Northrop Grumman', c: 'US', mcap: 7.0e10, note: 'B-21, ICBM modernisation' },
        { t: 'GD', n: 'General Dynamics', c: 'US', mcap: 7.5e10, note: 'Munitions, submarines' },
        { t: 'BA.L', n: 'BAE Systems', c: 'GB', mcap: 6.0e10, note: 'European rearmament' },
        { t: 'RHM.DE', n: 'Rheinmetall', c: 'DE', mcap: 3.0e10, note: 'Artillery shells; EU budgets' },
        { t: 'HO.PA', n: 'Thales', c: 'FR', mcap: 3.5e10, note: 'Radar, air defence' },
        { t: 'ESLT', n: 'Elbit Systems', c: 'IL', mcap: 1.4e10, note: 'Drones, Mideast demand' }
      ]
    },
    {
      id: 'semis', n: 'Semiconductors', icon: '🔲', color: '#14806e',
      exp: { oil: -0.10, rates: -0.45, usd: -0.15, war: -0.35, china: 0.55, consumer: 0.35, inflation: -0.25 },
      leaders: [
        { t: 'NVDA', n: 'NVIDIA', c: 'US', mcap: 3.0e12, note: 'AI accelerators; TSMC-dependent' },
        { t: 'TSM', n: 'TSMC', c: 'TW', mcap: 9.0e11, note: '~90% of leading-edge logic' },
        { t: 'ASML', n: 'ASML', c: 'NL', mcap: 3.0e11, note: 'EUV monopoly; export controls' },
        { t: 'AVGO', n: 'Broadcom', c: 'US', mcap: 7.0e11, note: 'Custom ASIC + networking' },
        { t: 'AMD', n: 'AMD', c: 'US', mcap: 2.4e11, note: 'Datacenter GPU/CPU' },
        { t: '005930.KS', n: 'Samsung Electronics', c: 'KR', mcap: 3.6e11, note: 'Memory + foundry' },
        { t: '000660.KS', n: 'SK Hynix', c: 'KR', mcap: 1.1e11, note: 'HBM leadership' },
        { t: 'INTC', n: 'Intel', c: 'US', mcap: 1.0e11, note: 'US onshoring / CHIPS' }
      ]
    },
    {
      id: 'tech', n: 'Software & Platforms', icon: '💻', color: '#5b4bb5',
      exp: { oil: -0.10, rates: -0.55, usd: -0.10, war: -0.20, china: 0.20, consumer: 0.40, inflation: -0.30 },
      leaders: [
        { t: 'MSFT', n: 'Microsoft', c: 'US', mcap: 3.1e12, note: 'Cloud + AI capex anchor' },
        { t: 'AAPL', n: 'Apple', c: 'US', mcap: 3.3e12, note: 'China assembly concentration' },
        { t: 'GOOGL', n: 'Alphabet', c: 'US', mcap: 2.1e12, note: 'Ads cycle = consumer proxy' },
        { t: 'AMZN', n: 'Amazon', c: 'US', mcap: 2.0e12, note: 'AWS + consumer logistics' },
        { t: 'META', n: 'Meta', c: 'US', mcap: 1.3e12, note: 'Ad spend sensitivity' },
        { t: 'SAP', n: 'SAP', c: 'DE', mcap: 2.4e11, note: 'European enterprise software' },
        { t: '9988.HK', n: 'Alibaba', c: 'CN', mcap: 2.0e11, note: 'China consumer proxy' },
        { t: 'INFY', n: 'Infosys', c: 'IN', mcap: 7.5e10, note: 'IT services outsourcing' }
      ]
    },
    {
      id: 'banks', n: 'Banks & Financials', icon: '🏦', color: '#1d6b78',
      exp: { oil: 0.05, rates: 0.55, usd: 0.10, war: -0.35, china: 0.15, consumer: 0.45, inflation: 0.10 },
      leaders: [
        { t: 'JPM', n: 'JPMorgan Chase', c: 'US', mcap: 6.5e11, note: 'Systemic bellwether' },
        { t: 'BAC', n: 'Bank of America', c: 'US', mcap: 3.2e11, note: 'Rate-sensitive deposits' },
        { t: 'GS', n: 'Goldman Sachs', c: 'US', mcap: 1.6e11, note: 'Trading + volatility beta' },
        { t: 'HSBA.L', n: 'HSBC', c: 'GB', mcap: 1.7e11, note: 'Asia trade finance' },
        { t: 'BNP.PA', n: 'BNP Paribas', c: 'FR', mcap: 8.0e10, note: 'Eurozone credit' },
        { t: 'UBSG.SW', n: 'UBS', c: 'CH', mcap: 1.0e11, note: 'Global wealth flows' },
        { t: '8306.T', n: 'Mitsubishi UFJ', c: 'JP', mcap: 1.3e11, note: 'BoJ policy proxy' },
        { t: 'BRK.B', n: 'Berkshire Hathaway', c: 'US', mcap: 1.0e12, note: 'Cash pile = risk barometer' }
      ]
    },
    {
      id: 'autos', n: 'Autos & EV', icon: '🚗', color: '#b5527a',
      exp: { oil: -0.30, rates: -0.50, usd: -0.10, war: -0.25, china: 0.60, consumer: 0.70, inflation: -0.35 },
      leaders: [
        { t: 'TSLA', n: 'Tesla', c: 'US', mcap: 8.0e11, note: 'EV + battery + energy storage' },
        { t: 'TM', n: 'Toyota', c: 'JP', mcap: 2.6e11, note: 'Hybrid hedge on EV transition' },
        { t: '1211.HK', n: 'BYD', c: 'CN', mcap: 1.0e11, note: 'Vertically integrated EV/battery' },
        { t: 'VOW3.DE', n: 'Volkswagen', c: 'DE', mcap: 6.0e10, note: 'China exposure + EU energy costs' },
        { t: 'MBG.DE', n: 'Mercedes-Benz', c: 'DE', mcap: 6.0e10, note: 'Premium consumer cycle' },
        { t: 'GM', n: 'General Motors', c: 'US', mcap: 5.5e10, note: 'US credit-driven demand' },
        { t: 'F', n: 'Ford', c: 'US', mcap: 4.5e10, note: 'Fleet + fuel price sensitivity' },
        { t: 'STLA', n: 'Stellantis', c: 'NL', mcap: 4.0e10, note: 'Multi-region volume' }
      ]
    },
    {
      id: 'battery', n: 'Batteries, Solar & Grid', icon: '🔋', color: '#2e7d32',
      exp: { oil: 0.35, rates: -0.55, usd: -0.20, war: 0.10, china: 0.65, consumer: 0.25, inflation: -0.10 },
      leaders: [
        { t: '300750.SZ', n: 'CATL', c: 'CN', mcap: 1.5e11, note: '~35% global battery share' },
        { t: '051910.KS', n: 'LG Energy Solution', c: 'KR', mcap: 7.0e10, note: 'Non-China cell supply' },
        { t: 'ALB', n: 'Albemarle', c: 'US', mcap: 1.2e10, note: 'Lithium price beta' },
        { t: 'ENPH', n: 'Enphase', c: 'US', mcap: 9.0e9, note: 'Residential solar + rate sensitive' },
        { t: 'FSLR', n: 'First Solar', c: 'US', mcap: 2.0e10, note: 'Non-China panel supply' },
        { t: 'VWS.CO', n: 'Vestas', c: 'DK', mcap: 2.0e10, note: 'Wind capex' },
        { t: 'NEE', n: 'NextEra Energy', c: 'US', mcap: 1.5e11, note: 'Largest renewables utility' },
        { t: 'PWR', n: 'Quanta Services', c: 'US', mcap: 4.5e10, note: 'Grid buildout contractor' }
      ]
    },
    {
      id: 'mining', n: 'Mining & Materials', icon: '⛏', color: '#8a6134',
      exp: { oil: 0.35, rates: -0.25, usd: -0.45, war: 0.30, china: 0.80, consumer: 0.20, inflation: 0.55 },
      leaders: [
        { t: 'BHP', n: 'BHP', c: 'AU', mcap: 1.4e11, note: 'Iron ore = China construction' },
        { t: 'RIO', n: 'Rio Tinto', c: 'AU', mcap: 1.0e11, note: 'Iron, copper, aluminium' },
        { t: 'VALE', n: 'Vale', c: 'BR', mcap: 4.5e10, note: 'Iron ore + nickel' },
        { t: 'FCX', n: 'Freeport-McMoRan', c: 'US', mcap: 6.0e10, note: 'Copper = electrification' },
        { t: 'GLEN.L', n: 'Glencore', c: 'CH', mcap: 6.0e10, note: 'Cobalt/copper + trading desk' },
        { t: 'NEM', n: 'Newmont', c: 'US', mcap: 5.0e10, note: 'Gold; crisis hedge' },
        { t: 'AA', n: 'Alcoa', c: 'US', mcap: 1.0e10, note: 'Aluminium = power cost proxy' },
        { t: 'MP', n: 'MP Materials', c: 'US', mcap: 5.0e9, note: 'Rare earths ex-China' }
      ]
    },
    {
      id: 'shipping', n: 'Shipping & Logistics', icon: '🚢', color: '#2a6b8f',
      exp: { oil: -0.35, rates: -0.25, usd: 0.05, war: 0.55, china: 0.65, consumer: 0.45, inflation: 0.25 },
      leaders: [
        { t: 'MAERSK-B.CO', n: 'A.P. Moller-Maersk', c: 'DK', mcap: 2.5e10, note: 'Container rates = chokepoint proxy' },
        { t: 'ZIM', n: 'ZIM Integrated', c: 'IL', mcap: 2.5e9, note: 'High-beta container spot rates' },
        { t: 'FRO', n: 'Frontline', c: 'NO', mcap: 5.0e9, note: 'Crude tankers; ton-mile expansion' },
        { t: 'STNG', n: 'Scorpio Tankers', c: 'MC', mcap: 3.5e9, note: 'Product tankers on rerouting' },
        { t: 'UPS', n: 'UPS', c: 'US', mcap: 1.0e11, note: 'US parcel = consumer health' },
        { t: 'FDX', n: 'FedEx', c: 'US', mcap: 6.5e10, note: 'Global freight barometer' },
        { t: 'DSV.CO', n: 'DSV', c: 'DK', mcap: 4.0e10, note: 'Freight forwarding spreads' },
        { t: '2020.HK', n: 'COSCO Shipping', c: 'CN', mcap: 2.0e10, note: 'China export volumes' }
      ]
    },
    {
      id: 'health', n: 'Healthcare & Pharma', icon: '⚕', color: '#9c4f86',
      exp: { oil: -0.05, rates: -0.20, usd: -0.05, war: 0.05, china: 0.10, consumer: 0.10, inflation: -0.10 },
      leaders: [
        { t: 'LLY', n: 'Eli Lilly', c: 'US', mcap: 7.5e11, note: 'GLP-1 franchise' },
        { t: 'NOVO-B.CO', n: 'Novo Nordisk', c: 'DK', mcap: 3.5e11, note: 'GLP-1; Danish index weight' },
        { t: 'JNJ', n: 'Johnson & Johnson', c: 'US', mcap: 3.8e11, note: 'Defensive ballast' },
        { t: 'UNH', n: 'UnitedHealth', c: 'US', mcap: 4.5e11, note: 'US healthcare policy risk' },
        { t: 'ROG.SW', n: 'Roche', c: 'CH', mcap: 2.3e11, note: 'Diagnostics + oncology' },
        { t: 'AZN', n: 'AstraZeneca', c: 'GB', mcap: 2.2e11, note: 'Global oncology' },
        { t: 'PFE', n: 'Pfizer', c: 'US', mcap: 1.6e11, note: 'Post-COVID normalisation' },
        { t: 'SUNPHARMA.NS', n: 'Sun Pharmaceutical', c: 'IN', mcap: 5.0e10, note: 'Generics supply chain' }
      ]
    },
    {
      id: 'agri', n: 'Agriculture & Food', icon: '🌾', color: '#8a7a12',
      exp: { oil: 0.45, rates: -0.15, usd: -0.30, war: 0.60, china: 0.45, consumer: 0.20, inflation: 0.70 },
      leaders: [
        { t: 'ADM', n: 'Archer-Daniels-Midland', c: 'US', mcap: 3.0e10, note: 'Grain crush margins' },
        { t: 'BG', n: 'Bunge Global', c: 'US', mcap: 1.3e10, note: 'Oilseed trade flows' },
        { t: 'NTR', n: 'Nutrien', c: 'CA', mcap: 2.5e10, note: 'Potash; Russia/Belarus supply' },
        { t: 'MOS', n: 'Mosaic', c: 'US', mcap: 8.0e9, note: 'Phosphate/potash' },
        { t: 'CF', n: 'CF Industries', c: 'US', mcap: 1.4e10, note: 'Nitrogen = natgas derivative' },
        { t: 'DE', n: 'Deere & Co', c: 'US', mcap: 1.1e11, note: 'Farm capex cycle' },
        { t: 'NESN.SW', n: 'Nestlé', c: 'CH', mcap: 2.3e11, note: 'Food inflation pass-through' },
        { t: 'TSN', n: 'Tyson Foods', c: 'US', mcap: 2.0e10, note: 'Protein + feed costs' }
      ]
    },
    {
      id: 'utilities', n: 'Utilities & Power', icon: '⚡', color: '#2c7c91',
      exp: { oil: 0.25, rates: -0.60, usd: 0.00, war: 0.15, china: 0.10, consumer: -0.10, inflation: 0.35 },
      leaders: [
        { t: 'NEE', n: 'NextEra Energy', c: 'US', mcap: 1.5e11, note: 'Regulated + renewables' },
        { t: 'DUK', n: 'Duke Energy', c: 'US', mcap: 8.5e10, note: 'Rate-base growth' },
        { t: 'SO', n: 'Southern Company', c: 'US', mcap: 9.5e10, note: 'Nuclear + datacenter load' },
        { t: 'IBE.MC', n: 'Iberdrola', c: 'ES', mcap: 9.0e10, note: 'European grid + wind' },
        { t: 'ENEL.MI', n: 'Enel', c: 'IT', mcap: 7.5e10, note: 'Southern EU power prices' },
        { t: 'EOAN.DE', n: 'E.ON', c: 'DE', mcap: 3.5e10, note: 'German grid; gas pass-through' },
        { t: 'CEG', n: 'Constellation Energy', c: 'US', mcap: 7.0e10, note: 'Nuclear PPAs for AI datacenters' },
        { t: 'VST', n: 'Vistra', c: 'US', mcap: 4.5e10, note: 'Merchant power price beta' }
      ]
    },
    {
      id: 'airlines', n: 'Airlines & Travel', icon: '✈', color: '#7a4a96',
      exp: { oil: -0.85, rates: -0.35, usd: 0.10, war: -0.55, china: 0.30, consumer: 0.80, inflation: -0.45 },
      leaders: [
        { t: 'DAL', n: 'Delta Air Lines', c: 'US', mcap: 3.5e10, note: 'Jet fuel = 25% of opex' },
        { t: 'UAL', n: 'United Airlines', c: 'US', mcap: 3.0e10, note: 'International long-haul' },
        { t: 'LUV', n: 'Southwest Airlines', c: 'US', mcap: 1.8e10, note: 'Domestic leisure demand' },
        { t: 'AF.PA', n: 'Air France-KLM', c: 'FR', mcap: 3.0e9, note: 'EU routing over Mideast' },
        { t: 'RYA.IR', n: 'Ryanair', c: 'IE', mcap: 2.2e10, note: 'Fuel-hedge discipline' },
        { t: 'IAG.L', n: 'IAG', c: 'GB', mcap: 1.5e10, note: 'Transatlantic capacity' },
        { t: 'BKNG', n: 'Booking Holdings', c: 'US', mcap: 1.5e11, note: 'Discretionary travel spend' },
        { t: 'CCL', n: 'Carnival', c: 'US', mcap: 2.5e10, note: 'Fuel + consumer credit' }
      ]
    },
    {
      id: 'consumer', n: 'Consumer & Retail', icon: '🛒', color: '#a35d1f',
      exp: { oil: -0.40, rates: -0.40, usd: 0.10, war: -0.25, china: 0.35, consumer: 0.95, inflation: -0.55 },
      leaders: [
        { t: 'WMT', n: 'Walmart', c: 'US', mcap: 7.0e11, note: 'Trade-down beneficiary' },
        { t: 'COST', n: 'Costco', c: 'US', mcap: 4.0e11, note: 'Membership resilience' },
        { t: 'HD', n: 'Home Depot', c: 'US', mcap: 3.5e11, note: 'Housing + rates' },
        { t: 'MC.PA', n: 'LVMH', c: 'FR', mcap: 3.2e11, note: 'China luxury demand' },
        { t: 'NKE', n: 'Nike', c: 'US', mcap: 1.1e11, note: 'Asia supply chain + China' },
        { t: 'MCD', n: "McDonald's", c: 'US', mcap: 2.1e11, note: 'Defensive value trade-down' },
        { t: '2330.TW', n: 'Uniqlo/Fast Retailing', c: 'JP', mcap: 1.0e11, note: 'Asia discretionary' },
        { t: 'PG', n: 'Procter & Gamble', c: 'US', mcap: 3.8e11, note: 'Staples pricing power' }
      ]
    },
    {
      id: 'crypto', n: 'Digital Assets', icon: '₿', color: '#a86a00',
      exp: { oil: 0.05, rates: -0.70, usd: -0.55, war: 0.20, china: 0.10, consumer: 0.35, inflation: 0.30 },
      leaders: [
        { t: 'BTC', n: 'Bitcoin', c: 'US', mcap: 1.3e12, note: 'Liquidity/debasement proxy' },
        { t: 'ETH', n: 'Ethereum', c: 'US', mcap: 4.0e11, note: 'Settlement layer; staking yield' },
        { t: 'COIN', n: 'Coinbase', c: 'US', mcap: 6.0e10, note: 'Exchange volume beta' },
        { t: 'MSTR', n: 'MicroStrategy', c: 'US', mcap: 5.0e10, note: 'Levered BTC treasury' },
        { t: 'MARA', n: 'MARA Holdings', c: 'US', mcap: 6.0e9, note: 'Hashrate + power costs' },
        { t: 'IBIT', n: 'iShares Bitcoin Trust', c: 'US', mcap: 5.0e10, note: 'Institutional flow gauge' },
        { t: 'HOOD', n: 'Robinhood', c: 'US', mcap: 3.5e10, note: 'Retail risk appetite' },
        { t: 'CRCL', n: 'Circle (USDC)', c: 'US', mcap: 2.0e10, note: 'Stablecoin float = T-bill demand' }
      ]
    }
  ];

  /* ---------- commodities & macro instruments ---------- */
  var MACRO = [
    { t: 'CL=F', n: 'WTI Crude', cls: 'commodity', unit: '$/bbl', base: 78.4, vol: 0.028, note: 'Primary war/energy transmission channel' },
    { t: 'BZ=F', n: 'Brent Crude', cls: 'commodity', unit: '$/bbl', base: 82.6, vol: 0.027, note: 'Global benchmark; Hormuz-sensitive' },
    { t: 'NG=F', n: 'Henry Hub Nat Gas', cls: 'commodity', unit: '$/MMBtu', base: 2.95, vol: 0.045, note: 'US power + fertiliser input' },
    { t: 'TTF', n: 'Dutch TTF Gas', cls: 'commodity', unit: '€/MWh', base: 34.0, vol: 0.05, note: 'European industrial cost base' },
    { t: 'GC=F', n: 'Gold', cls: 'commodity', unit: '$/oz', base: 2380, vol: 0.011, note: 'Crisis + real-rate hedge' },
    { t: 'HG=F', n: 'Copper', cls: 'commodity', unit: '$/lb', base: 4.35, vol: 0.018, note: 'Electrification + China demand' },
    { t: 'ZW=F', n: 'Wheat', cls: 'commodity', unit: '$/bu', base: 5.80, vol: 0.022, note: 'Black Sea supply risk' },
    { t: 'LI', n: 'Lithium Carbonate', cls: 'commodity', unit: '$/t', base: 13500, vol: 0.024, note: 'Battery cost curve' },
    { t: 'URA', n: 'Uranium U3O8', cls: 'commodity', unit: '$/lb', base: 82.0, vol: 0.02, note: 'Nuclear restart cycle' },
    { t: 'US10Y', n: 'US 10Y Yield', cls: 'rate', unit: '%', base: 4.28, vol: 0.016, note: 'Global discount rate' },
    { t: 'DXY', n: 'US Dollar Index', cls: 'fx', unit: 'idx', base: 104.2, vol: 0.005, note: 'Global liquidity tightener' },
    { t: 'VIX', n: 'CBOE Volatility Index', cls: 'vol', unit: 'idx', base: 14.8, vol: 0.075, note: 'Equity fear gauge' },
    { t: 'SPY', n: 'S&P 500 ETF', cls: 'equity', unit: '$', base: 552, vol: 0.009, note: 'Beta benchmark' },
    { t: 'QQQ', n: 'Nasdaq 100 ETF', cls: 'equity', unit: '$', base: 478, vol: 0.012, note: 'Duration-sensitive growth' },
    { t: 'BDI', n: 'Baltic Dry Index', cls: 'index', unit: 'idx', base: 1850, vol: 0.035, note: 'Dry bulk freight demand' },
    { t: 'TNKR', n: 'Clean Tanker Rates', cls: 'index', unit: 'WS', base: 118, vol: 0.04, note: 'Rerouting/ton-mile proxy' }
  ];

  /* ---------- named actors whose statements move markets ---------- */
  var ACTORS = [
    { id: 'us_pres', n: 'US President', role: 'Head of state', c: 'US', power: 1.00, ch: ['Truth Social', 'press pool', 'executive orders'],
      moves: ['tariffs', 'sanctions', 'strikes', 'energy policy'], note: 'Single posts have repriced crude, tariff-exposed names and index futures within minutes.' },
    { id: 'fed_chair', n: 'Fed Chair', role: 'Central bank', c: 'US', power: 0.95, ch: ['FOMC presser', 'Jackson Hole', 'testimony'],
      moves: ['rates', 'usd', 'duration'], note: 'Sets the global discount rate; dominant driver for growth/duration assets.' },
    { id: 'opec_sec', n: 'OPEC+ / Saudi Energy Ministry', role: 'Cartel policy', c: 'SA', power: 0.85, ch: ['OPEC+ meetings', 'SPA wire'],
      moves: ['oil'], note: 'Quota and spare-capacity signalling; the counterweight to supply shocks.' },
    { id: 'irgc', n: 'IRGC / Iranian leadership', role: 'State military', c: 'IR', power: 0.75, ch: ['IRNA', 'Tasnim'],
      moves: ['oil', 'war', 'shipping'], note: 'Hormuz transit threats are the highest-convexity oil headline class.' },
    { id: 'pboc', n: 'PBoC / State Council', role: 'Central bank + policy', c: 'CN', power: 0.85, ch: ['Xinhua', 'PBoC statements'],
      moves: ['china', 'commodities', 'usd'], note: 'Stimulus announcements drive the industrial-commodity complex.' },
    { id: 'ecb', n: 'ECB President', role: 'Central bank', c: 'DE', power: 0.70, ch: ['ECB presser'], moves: ['rates', 'eur'], note: 'Eurozone credit conditions and bank margins.' },
    { id: 'ustr', n: 'USTR / Commerce', role: 'Trade & export control', c: 'US', power: 0.80, ch: ['Federal Register', 'BIS entity list'],
      moves: ['semis', 'china', 'tariffs'], note: 'Entity-list additions reprice semicap and China ADRs same-session.' }
  ];

  var SECTOR_BY_TICKER = {};
  INDUSTRIES.forEach(function (ind) {
    ind.leaders.forEach(function (l) { SECTOR_BY_TICKER[l.t] = ind.id; });
  });

  /* Secondary registry: regional and domestic names (ASX builders, insurers, repairers...)
     that belong to an existing industry but are not among its global leaders. They resolve
     for charts, quotes and link analysis exactly like a leader does. */
  var EXTRA = [];
  var EXTRA_BY_T = {};
  function registerCompanies(list) {
    (list || []).forEach(function (c) {
      if (!c || !c.t || EXTRA_BY_T[c.t.toUpperCase()] || SECTOR_BY_TICKER[c.t]) return;
      var ind = findIndustry(c.sector);
      var rec = {
        t: c.t, n: c.n, c: c.c, mcap: c.mcap || 0, note: c.note || '',
        sector: c.sector, sectorName: ind ? ind.n : c.sector,
        color: ind ? ind.color : '#7d8896', extra: true
      };
      EXTRA.push(rec);
      EXTRA_BY_T[c.t.toUpperCase()] = rec;
      SECTOR_BY_TICKER[c.t] = c.sector;
    });
    _leaderCache = null;
  }

  var _leaderCache = null;
  function allLeaders() {
    if (_leaderCache) return _leaderCache;
    var out = [];
    INDUSTRIES.forEach(function (ind) {
      ind.leaders.forEach(function (l) {
        out.push({ t: l.t, n: l.n, c: l.c, mcap: l.mcap, note: l.note, sector: ind.id, sectorName: ind.n, color: ind.color });
      });
    });
    _leaderCache = out.concat(EXTRA);
    return _leaderCache;
  }
  function findIndustry(id) {
    for (var i = 0; i < INDUSTRIES.length; i++) if (INDUSTRIES[i].id === id) return INDUSTRIES[i];
    return null;
  }
  function findEntity(sym) {
    var s = String(sym || '').toUpperCase();
    if (EXTRA_BY_T[s]) return EXTRA_BY_T[s];
    var L = allLeaders();
    for (var i = 0; i < L.length; i++) if (L[i].t.toUpperCase() === s) return L[i];
    for (var j = 0; j < MACRO.length; j++) if (MACRO[j].t.toUpperCase() === s) {
      return { t: MACRO[j].t, n: MACRO[j].n, c: null, sector: MACRO[j].cls, sectorName: MACRO[j].cls, note: MACRO[j].note, macro: MACRO[j] };
    }
    return null;
  }

  global.UNIVERSE = {
    REGIONS: REGIONS, COUNTRIES: COUNTRIES, CHOKEPOINTS: CHOKEPOINTS,
    INDUSTRIES: INDUSTRIES, MACRO: MACRO, ACTORS: ACTORS,
    SECTOR_BY_TICKER: SECTOR_BY_TICKER,
    allLeaders: allLeaders, findIndustry: findIndustry, findEntity: findEntity,
    registerCompanies: registerCompanies, extras: function () { return EXTRA.slice(); }
  };
})(window);
