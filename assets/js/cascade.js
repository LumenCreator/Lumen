/* Lumen Terminal — contagion engine.
   A directed causal graph of shocks, transmission channels, sectors and instruments.
   Edges carry a conditional probability, a lag, a magnitude and the mechanism behind them,
   so a propagation run produces an auditable chain, not a black-box score. */
(function (global) {
  'use strict';
  var L = global.Lumen, U = global.UNIVERSE, M = L.M;

  /* kind: shock | channel | macro | social | policy | sector | asset */
  var NODES = [
    /* ---- seeds / shocks ---- */
    { id: 'me_conflict', n: 'Escalation in the Middle East', short: 'Middle East', kind: 'shock', c: ['IR', 'IL', 'SA', 'QA'], seed: true,
      d: 'Direct exchange of strikes between regional powers, or a strike on energy infrastructure.' },
    { id: 'taiwan_crisis', n: 'Taiwan Strait crisis', short: 'Taiwan', kind: 'shock', c: ['TW', 'CN', 'US', 'JP'], seed: true,
      d: 'Blockade, quarantine or exclusion-zone declaration around Taiwan.' },
    { id: 'russia_escalation', n: 'Russia / NATO escalation', short: 'Russia/NATO', kind: 'shock', c: ['RU', 'UA', 'PL', 'DE'], seed: true,
      d: 'Escalation touching NATO territory, Baltic infrastructure or the Black Sea grain corridor.' },
    { id: 'tariff_shock', n: 'Major tariff / trade action', short: 'Tariffs', kind: 'shock', c: ['US', 'CN', 'EU', 'MX'], seed: true,
      d: 'Broad tariff schedule or export-control expansion announced by a major economy.' },
    { id: 'china_stimulus', n: 'Large China stimulus', short: 'China stimulus', kind: 'shock', c: ['CN'], seed: true,
      d: 'Fiscal/property support package big enough to move the industrial commodity complex.' },
    { id: 'rate_shock', n: 'Hawkish policy surprise', short: 'Rate shock', kind: 'shock', c: ['US'], seed: true,
      d: 'Inflation print or central-bank guidance that repriceable rate expectations upward.' },
    { id: 'credit_event', n: 'Systemic credit event', short: 'Credit event', kind: 'shock', c: ['US', 'GB', 'CH'], seed: true,
      d: 'Failure of a leveraged institution large enough to force counterparty deleveraging.' },
    { id: 'cyber_infra', n: 'Cyberattack on critical infrastructure', short: 'Cyberattack', kind: 'shock', c: ['US', 'DE', 'GB'], seed: true,
      d: 'Pipeline, grid, port or clearing-system outage attributed to a state-linked actor.' },
    { id: 'nat_disaster', n: 'Major natural disaster', short: 'Disaster', kind: 'shock', c: ['AU', 'US', 'JP', 'IN'], seed: true,
      d: 'Flood, cyclone, fire or quake large enough to be declared a catastrophe. Destroys capital stock, which is a loss for insurers and a multi-year order book for whoever rebuilds it.' },

    /* ---- transmission channels ---- */
    { id: 'hormuz_risk', n: 'Hormuz transit disrupted', kind: 'channel', c: ['IR', 'AE', 'SA', 'QA', 'KW'], choke: 'hormuz' },
    { id: 'redsea_risk', n: 'Red Sea / Suez rerouting', kind: 'channel', c: ['EG', 'SA', 'IL'], choke: 'suez' },
    { id: 'malacca_risk', n: 'Malacca / South China Sea risk', kind: 'channel', c: ['SG', 'MY', 'CN'], choke: 'malacca' },
    { id: 'blackSea_risk', n: 'Black Sea grain corridor at risk', kind: 'channel', c: ['UA', 'RU', 'TR'], choke: 'bosphorus' },
    { id: 'chip_supply', n: 'Advanced logic supply interrupted', kind: 'channel', c: ['TW', 'KR', 'JP'] },
    { id: 'rare_earth', n: 'Critical minerals export controls', kind: 'channel', c: ['CN', 'CD', 'ID'] },
    { id: 'freight_up', n: 'Freight & war-risk premia rise', kind: 'channel', c: ['SG', 'EG', 'AE'] },
    { id: 'sanctions', n: 'Sanctions / secondary sanctions', kind: 'policy', c: ['US', 'EU', 'RU', 'IR'] },

    /* ---- macro ---- */
    { id: 'oil_spike', n: 'Crude & refined products spike', kind: 'macro', px: ['CL=F', 'BZ=F'] },
    { id: 'gas_spike', n: 'Natural gas / LNG spike', kind: 'macro', px: ['NG=F', 'TTF'] },
    { id: 'pump_prices', n: 'Retail fuel prices rise', kind: 'macro' },
    { id: 'fuel_margin_squeeze', n: 'Fuel retailers squeezed on margin', kind: 'sector' },
    { id: 'cpi_up', n: 'Headline inflation re-accelerates', kind: 'macro' },
    { id: 'rates_higher', n: 'Rates repriced higher for longer', kind: 'macro', px: ['US10Y'] },
    { id: 'usd_up', n: 'Dollar strengthens', kind: 'macro', px: ['DXY'] },
    { id: 'vol_up', n: 'Cross-asset volatility expands', kind: 'macro', px: ['VIX'] },
    { id: 'credit_tighten', n: 'Credit conditions tighten', kind: 'macro' },
    { id: 'power_prices', n: 'Wholesale power prices rise', kind: 'macro' },
    { id: 'elec_bills', n: 'Household electricity bills rise', kind: 'macro' },
    { id: 'food_prices', n: 'Food & fertiliser prices rise', kind: 'macro', px: ['ZW=F'] },
    { id: 'discretionary_down', n: 'Discretionary spending contracts', kind: 'macro' },
    { id: 'ev_demand', n: 'Shift toward electric / efficient transport', kind: 'macro' },
    { id: 'battery_demand', n: 'Battery & storage demand accelerates', kind: 'macro', px: ['LI'] },
    { id: 'grid_capex', n: 'Grid & generation capex accelerates', kind: 'macro' },
    { id: 'nuclear_push', n: 'Nuclear / baseload restart push', kind: 'macro', px: ['URA'] },
    { id: 'china_demand_down', n: 'China industrial demand weakens', kind: 'macro', px: ['HG=F'] },
    { id: 'safe_haven', n: 'Safe-haven bid (gold, duration, USD)', kind: 'macro', px: ['GC=F'] },
    { id: 'reshoring', n: 'Supply-chain reshoring accelerates', kind: 'macro' },

    /* ---- social / political ---- */
    { id: 'cost_of_living', n: 'Cost-of-living squeeze', kind: 'social' },
    { id: 'public_anger', n: 'Public anger turns political', kind: 'social' },
    { id: 'strikes', n: 'Industrial action: nurses, transport, trades', kind: 'social' },
    { id: 'election_risk', n: 'Incumbent government under threat', kind: 'social' },
    { id: 'subsidies', n: 'Government subsidies & price caps', kind: 'policy' },
    { id: 'windfall_tax', n: 'Windfall taxes on energy & banks', kind: 'policy' },
    { id: 'fiscal_deficit', n: 'Fiscal deficit widens', kind: 'policy' },
    { id: 'bond_supply', n: 'Sovereign bond supply increases', kind: 'policy' },
    { id: 'foreign_deals', n: 'New bilateral supply & currency deals', kind: 'policy' },
    { id: 'defense_budgets', n: 'Defence budgets expanded', kind: 'policy' },
    { id: 'health_strain', n: 'Public health & care systems strained', kind: 'social' },
    { id: 'rebuild_demand', n: 'Reconstruction demand', kind: 'macro' },
    { id: 'insured_loss', n: 'Insured losses & premium repricing', kind: 'macro' },
    { id: 'capital_controls', n: 'EM stress: FX intervention / controls', kind: 'policy' },

    /* ---- sector outcomes ---- */
    { id: 's_energy', n: 'Energy producers', kind: 'sector', sec: 'energy' },
    { id: 's_defense', n: 'Defence & aerospace', kind: 'sector', sec: 'defense' },
    { id: 's_shipping', n: 'Tankers & shipping', kind: 'sector', sec: 'shipping' },
    { id: 's_airlines', n: 'Airlines & travel', kind: 'sector', sec: 'airlines' },
    { id: 's_semis', n: 'Semiconductors', kind: 'sector', sec: 'semis' },
    { id: 's_autos', n: 'Autos & EV', kind: 'sector', sec: 'autos' },
    { id: 's_battery', n: 'Batteries, solar & grid', kind: 'sector', sec: 'battery' },
    { id: 's_mining', n: 'Mining & materials', kind: 'sector', sec: 'mining' },
    { id: 's_utilities', n: 'Utilities & power', kind: 'sector', sec: 'utilities' },
    { id: 's_banks', n: 'Banks & financials', kind: 'sector', sec: 'banks' },
    { id: 's_consumer', n: 'Consumer & retail', kind: 'sector', sec: 'consumer' },
    { id: 's_staples', n: 'Consumer staples & discounters', kind: 'sector', sec: 'consumer' },
    { id: 's_health', n: 'Healthcare & pharma', kind: 'sector', sec: 'health' },
    { id: 's_agri', n: 'Agriculture & fertiliser', kind: 'sector', sec: 'agri' },
    { id: 's_tech', n: 'Software & platforms', kind: 'sector', sec: 'tech' },
    { id: 's_crypto', n: 'Digital assets', kind: 'sector', sec: 'crypto' }
  ];

  /* p: conditional probability | lag: days | mag: intensity multiplier | s: +1 benefits / -1 hurts */
  var EDGES = [
    /* Middle East escalation */
    ['me_conflict', 'hormuz_risk', 0.34, 2, 1.00, 1, 'Iran\'s asymmetric response option is to threaten or harass transit through the strait.'],
    ['me_conflict', 'redsea_risk', 0.55, 3, 0.75, 1, 'Proxy attacks on shipping extend to the Bab el-Mandeb approach.'],
    ['me_conflict', 'oil_spike', 0.72, 0, 0.60, 1, 'Risk premium is priced into crude before any barrel is actually lost.'],
    ['me_conflict', 'defense_budgets', 0.60, 30, 0.70, 1, 'Munitions drawdown forces replenishment appropriations.'],
    ['me_conflict', 'safe_haven', 0.65, 0, 0.55, 1, 'Gold and duration bid on geopolitical tail risk.'],
    ['me_conflict', 'sanctions', 0.50, 10, 0.60, 1, 'Escalation is met with expanded designations on shipping and finance.'],
    ['hormuz_risk', 'oil_spike', 0.92, 0, 1.00, 1, '~20M bbl/d and a fifth of LNG transit the strait; there is no full bypass.'],
    ['hormuz_risk', 'gas_spike', 0.70, 1, 0.85, 1, 'Qatari LNG has no alternative export route.'],
    ['hormuz_risk', 'freight_up', 0.85, 1, 0.90, 1, 'War-risk insurance and rerouting lift effective freight cost.'],
    ['redsea_risk', 'freight_up', 0.80, 2, 0.70, 1, 'Cape of Good Hope routing adds ~10-14 days per voyage.'],
    ['blackSea_risk', 'food_prices', 0.75, 5, 0.80, 1, 'Ukraine/Russia are a third of traded wheat and a large share of fertiliser.'],
    ['russia_escalation', 'blackSea_risk', 0.60, 3, 0.90, 1, 'Corridor guarantees lapse when the conflict widens.'],
    ['russia_escalation', 'gas_spike', 0.55, 2, 0.80, 1, 'Residual pipeline flows and Baltic LNG become bargaining chips.'],
    ['russia_escalation', 'defense_budgets', 0.80, 20, 0.90, 1, 'European rearmament programmes are pulled forward.'],
    ['russia_escalation', 'sanctions', 0.75, 5, 0.80, 1, 'Shadow-fleet and secondary sanctions expand.'],
    ['russia_escalation', 'safe_haven', 0.60, 0, 0.60, 1, 'Flight to quality in gold and core duration.'],

    /* oil complex */
    ['oil_spike', 'pump_prices', 0.90, 10, 0.85, 1, 'Retail passes through crude with a two-week lag.'],
    ['oil_spike', 'cpi_up', 0.80, 20, 0.70, 1, 'Energy feeds headline CPI directly and core with a lag.'],
    ['oil_spike', 's_energy', 0.90, 0, 1.00, 1, 'Producer margins expand faster than costs.'],
    ['oil_spike', 's_airlines', 0.85, 1, 0.90, -1, 'Jet fuel is roughly a quarter of airline operating cost.'],
    ['oil_spike', 's_shipping', 0.60, 2, 0.60, 1, 'Tanker ton-miles expand as flows are rerouted.'],
    ['oil_spike', 'ev_demand', 0.55, 90, 0.60, 1, 'Sustained pump prices shift the total-cost-of-ownership maths toward electric.'],
    ['oil_spike', 'nuclear_push', 0.35, 120, 0.50, 1, 'Energy security arguments strengthen baseload programmes.'],
    ['gas_spike', 'power_prices', 0.85, 5, 0.90, 1, 'Gas sets the marginal price in most liberalised power markets.'],
    ['gas_spike', 'food_prices', 0.55, 45, 0.60, 1, 'Nitrogen fertiliser is a natural gas derivative.'],
    ['gas_spike', 's_utilities', 0.60, 5, 0.55, -1, 'Unhedged generators face input costs they cannot immediately recover.'],
    ['pump_prices', 'fuel_margin_squeeze', 0.65, 5, 0.70, -1, 'Forecourt volumes fall and margin per litre compresses on price-sensitive demand.'],
    ['pump_prices', 'discretionary_down', 0.70, 20, 0.65, 1, 'Fuel is a non-discretionary claim on the household budget.'],
    ['pump_prices', 'ev_demand', 0.60, 60, 0.70, 1, 'The switching decision is made at the pump, not in the showroom.'],

    /* inflation → rates → credit */
    ['cpi_up', 'rates_higher', 0.70, 10, 0.85, 1, 'Policy reaction function responds to persistent headline pressure.'],
    ['cpi_up', 'cost_of_living', 0.85, 20, 0.90, 1, 'Real wages compress when price growth outpaces pay.'],
    ['rates_higher', 'credit_tighten', 0.75, 30, 0.80, 1, 'Funding costs rise and lending standards tighten.'],
    ['rates_higher', 's_utilities', 0.70, 5, 0.60, -1, 'Bond-proxy valuations de-rate as discount rates rise.'],
    ['rates_higher', 's_tech', 0.70, 2, 0.75, -1, 'Long-duration cash flows are the most rate-sensitive.'],
    ['rates_higher', 's_banks', 0.60, 5, 0.55, 1, 'Net interest margin expands before credit costs catch up.'],
    ['rates_higher', 'usd_up', 0.65, 1, 0.60, 1, 'Rate differentials pull capital into the dollar.'],
    ['rates_higher', 's_crypto', 0.55, 2, 0.60, -1, 'Liquidity-sensitive assets de-rate with real rates.'],
    ['rate_shock', 'rates_higher', 0.90, 0, 1.00, 1, 'Direct repricing of the policy path.'],
    ['rate_shock', 'vol_up', 0.60, 0, 0.55, 1, 'Rate volatility transmits to equity and FX volatility.'],
    ['usd_up', 'capital_controls', 0.35, 40, 0.60, 1, 'Dollar strength drains reserves in deficit economies.'],
    ['usd_up', 's_mining', 0.55, 5, 0.45, -1, 'Dollar-priced commodities face a demand headwind.'],
    ['credit_tighten', 'discretionary_down', 0.70, 40, 0.70, 1, 'Credit-financed consumption falls first.'],
    ['credit_tighten', 's_banks', 0.55, 60, 0.70, -1, 'Provisions rise as the cycle turns.'],
    ['credit_event', 'credit_tighten', 0.85, 5, 1.00, 1, 'Counterparty risk forces balance-sheet retrenchment.'],
    ['credit_event', 'vol_up', 0.85, 0, 0.90, 1, 'Forced deleveraging drives correlated liquidation.'],
    ['credit_event', 'safe_haven', 0.75, 0, 0.80, 1, 'Duration and gold bid on systemic risk.'],

    /* electrification chain (the user's example, made explicit) */
    ['ev_demand', 'battery_demand', 0.85, 30, 0.90, 1, 'Vehicle electrification is the marginal driver of cell demand.'],
    ['ev_demand', 's_autos', 0.70, 20, 0.60, 1, 'Mix shifts toward electric platforms; legacy ICE volumes lag.'],
    ['battery_demand', 's_battery', 0.90, 10, 1.00, 1, 'Cell makers and storage integrators capture the volume.'],
    ['battery_demand', 's_mining', 0.80, 30, 0.80, 1, 'Lithium, nickel, cobalt, graphite and copper demand all lift.'],
    ['battery_demand', 'power_prices', 0.45, 90, 0.50, 1, 'Charging load adds to an already tight grid.'],
    ['ev_demand', 'power_prices', 0.50, 120, 0.55, 1, 'Transport electrification raises system-wide load.'],
    ['power_prices', 'elec_bills', 0.85, 60, 0.90, 1, 'Wholesale costs reach households through regulated price resets.'],
    ['power_prices', 'grid_capex', 0.70, 90, 0.75, 1, 'Scarcity pricing justifies transmission and generation investment.'],
    ['power_prices', 's_utilities', 0.60, 10, 0.60, 1, 'Merchant generators capture spark spreads.'],
    ['grid_capex', 's_battery', 0.75, 30, 0.70, 1, 'Storage and interconnection are the bottleneck being funded.'],
    ['grid_capex', 's_mining', 0.70, 60, 0.65, 1, 'Copper and aluminium intensity of the grid buildout.'],
    ['nuclear_push', 's_utilities', 0.60, 90, 0.55, 1, 'Baseload owners are revalued on capacity scarcity.'],
    ['nuclear_push', 's_mining', 0.50, 60, 0.50, 1, 'Uranium demand curve steepens.'],
    ['elec_bills', 'cost_of_living', 0.85, 30, 0.85, 1, 'Energy is the most visible line in the household budget.'],
    ['elec_bills', 'discretionary_down', 0.70, 45, 0.70, 1, 'Bills crowd out everything discretionary.'],

    /* consumer → politics */
    ['cost_of_living', 'discretionary_down', 0.85, 30, 0.85, 1, 'Real income compression shows up in volumes, not prices.'],
    ['cost_of_living', 'public_anger', 0.75, 60, 0.80, 1, 'Sustained squeeze converts into political pressure.'],
    ['discretionary_down', 's_consumer', 0.80, 20, 0.80, -1, 'Discretionary retail and big-ticket goods take the volume hit.'],
    ['discretionary_down', 's_staples', 0.70, 20, 0.55, 1, 'Trade-down benefits discounters and staples.'],
    ['discretionary_down', 's_airlines', 0.65, 40, 0.60, -1, 'Leisure travel is the first cancellation.'],
    ['discretionary_down', 's_autos', 0.60, 40, 0.60, -1, 'New-vehicle demand is credit and confidence driven.'],
    ['public_anger', 'strikes', 0.60, 40, 0.70, 1, 'Pay disputes concentrate in nursing, transport and the trades.'],
    ['public_anger', 'election_risk', 0.70, 90, 0.80, 1, 'Incumbents carry the blame for price levels regardless of cause.'],
    ['strikes', 'health_strain', 0.65, 20, 0.70, 1, 'Care backlogs widen when staffing disputes run.'],
    ['strikes', 's_health', 0.55, 30, 0.50, 1, 'Staffing agencies and private providers absorb displaced demand.'],
    ['election_risk', 'subsidies', 0.75, 60, 0.85, 1, 'Governments buy time with transfers and price caps.'],
    ['election_risk', 'windfall_tax', 0.55, 90, 0.75, 1, 'Visible profits in energy and banking become the funding source.'],
    ['election_risk', 'vol_up', 0.45, 30, 0.45, 1, 'Policy uncertainty raises the risk premium.'],
    ['subsidies', 'fiscal_deficit', 0.85, 60, 0.85, 1, 'Transfers are rarely offset by revenue.'],
    ['subsidies', 's_consumer', 0.55, 60, 0.45, 1, 'Transfers partially restore the spending base.'],
    ['windfall_tax', 's_energy', 0.70, 30, 0.60, -1, 'Producer earnings are taxed at the point of maximum visibility.'],
    ['windfall_tax', 's_banks', 0.45, 30, 0.45, -1, 'Bank levies follow the same political logic.'],
    ['fiscal_deficit', 'bond_supply', 0.85, 60, 0.85, 1, 'Deficits are financed at the long end.'],
    ['bond_supply', 'rates_higher', 0.60, 30, 0.60, 1, 'Term premium rises with supply — the loop feeds back into rates.'],
    ['fiscal_deficit', 'foreign_deals', 0.50, 120, 0.60, 1, 'Bilateral supply, swap and offtake deals substitute for market financing.'],
    ['foreign_deals', 's_energy', 0.45, 90, 0.45, 1, 'State-to-state offtake locks in volumes for national champions.'],
    ['foreign_deals', 's_defense', 0.45, 120, 0.55, 1, 'Security guarantees are frequently packaged with supply agreements.'],
    ['foreign_deals', 's_agri', 0.45, 90, 0.50, 1, 'Food security agreements underwrite agricultural exporters.'],
    ['health_strain', 's_health', 0.60, 60, 0.60, 1, 'Backlog clearance funding flows to providers and staffing.'],

    /* defence */
    ['defense_budgets', 's_defense', 0.90, 30, 1.00, 1, 'Appropriations convert to backlog with a visible lag.'],
    ['defense_budgets', 'fiscal_deficit', 0.55, 90, 0.50, 1, 'Defence supplementals are additive to the deficit.'],
    ['defense_budgets', 's_mining', 0.40, 90, 0.40, 1, 'Munitions and platforms are metals-intensive.'],

    /* Taiwan / semis */
    ['taiwan_crisis', 'chip_supply', 0.75, 1, 1.00, 1, 'Leading-edge logic is concentrated on a single island.'],
    ['taiwan_crisis', 'malacca_risk', 0.50, 3, 0.70, 1, 'Regional naval activity threatens the Malacca approach.'],
    ['taiwan_crisis', 'vol_up', 0.85, 0, 0.90, 1, 'The largest single tail risk in global equities.'],
    ['taiwan_crisis', 'safe_haven', 0.75, 0, 0.75, 1, 'Reserve reallocation and gold bid.'],
    ['taiwan_crisis', 'defense_budgets', 0.70, 30, 0.85, 1, 'Indo-Pacific force posture funding accelerates.'],
    ['chip_supply', 's_semis', 0.85, 1, 1.00, -1, 'Foundry disruption hits everything downstream of advanced nodes.'],
    ['chip_supply', 's_autos', 0.70, 30, 0.70, -1, 'Vehicle production halts on controller shortages, as in 2021.'],
    ['chip_supply', 's_tech', 0.65, 10, 0.70, -1, 'Hardware and datacentre buildouts slip.'],
    ['chip_supply', 'reshoring', 0.75, 180, 0.80, 1, 'Concentration risk forces subsidised domestic capacity.'],
    ['reshoring', 's_semis', 0.60, 180, 0.55, 1, 'Onshore fabs and equipment orders are funded.'],
    ['reshoring', 'grid_capex', 0.50, 180, 0.50, 1, 'New fabs and plants need firm power.'],
    ['malacca_risk', 'freight_up', 0.75, 2, 0.80, 1, 'Alternative routing through Lombok/Sunda adds days and cost.'],

    /* trade / tariffs */
    ['tariff_shock', 'cpi_up', 0.60, 60, 0.55, 1, 'Tariffs are a tax paid at the border and passed to shelf price.'],
    ['tariff_shock', 'china_demand_down', 0.55, 45, 0.65, 1, 'Export volumes fall and industrial activity slows.'],
    ['tariff_shock', 'rare_earth', 0.45, 30, 0.70, 1, 'Retaliation targets the chokepoints the other side controls.'],
    ['tariff_shock', 's_consumer', 0.60, 60, 0.55, -1, 'Import-heavy retail carries the cost.'],
    ['tariff_shock', 'reshoring', 0.65, 180, 0.65, 1, 'Tariff walls make domestic capacity economic.'],
    ['tariff_shock', 'vol_up', 0.55, 0, 0.50, 1, 'Announcement risk is repriced across index futures.'],
    ['rare_earth', 's_defense', 0.55, 60, 0.55, -1, 'Magnets and optics inputs are concentrated upstream.'],
    ['rare_earth', 's_battery', 0.60, 45, 0.60, -1, 'Anode/graphite and processing capacity is concentrated in China.'],
    ['rare_earth', 's_mining', 0.65, 60, 0.70, 1, 'Ex-China supply is repriced on scarcity.'],
    ['china_demand_down', 's_mining', 0.80, 20, 0.85, -1, 'China is the marginal buyer of the industrial complex.'],
    ['china_demand_down', 's_shipping', 0.65, 30, 0.60, -1, 'Dry-bulk volumes fall with construction activity.'],
    ['china_stimulus', 's_mining', 0.75, 20, 0.85, 1, 'Property and infrastructure support lifts iron ore and copper.'],
    ['china_stimulus', 's_shipping', 0.60, 30, 0.60, 1, 'Dry-bulk demand recovers with restocking.'],
    ['china_stimulus', 's_consumer', 0.50, 60, 0.50, 1, 'Luxury and consumer exposure to China re-rates.'],
    ['china_stimulus', 'oil_spike', 0.40, 30, 0.45, 1, 'Marginal demand supports crude.'],

    /* natural disaster */
    ['nat_disaster', 'insured_loss', 0.90, 3, 1.00, 1, 'Catastrophe declaration attaches reinsurance and forces provisions in the same quarter.'],
    ['nat_disaster', 'rebuild_demand', 0.85, 30, 0.95, 1, 'Destroyed capital stock has to be replaced, and the order book runs for years rather than quarters.'],
    ['nat_disaster', 'power_prices', 0.50, 3, 0.60, 1, 'Generation and network outages force expensive replacement supply.'],
    ['nat_disaster', 'food_prices', 0.55, 45, 0.65, 1, 'Crop and herd losses remove supply from an already tight market.'],
    ['nat_disaster', 'health_strain', 0.60, 7, 0.55, 1, 'Injury surge and displacement land on the health system immediately.'],
    ['nat_disaster', 's_shipping', 0.45, 14, 0.50, 1, 'Port damage and rerouting lift freight rates on the affected lane.'],
    ['nat_disaster', 'subsidies', 0.65, 45, 0.70, 1, 'Disaster relief is the least politically contested spending there is.'],
    ['insured_loss', 's_banks', 0.75, 5, 0.70, -1, 'Insurers book the loss first; the premium repricing that follows is two quarters away.'],
    ['insured_loss', 'cost_of_living', 0.55, 180, 0.55, 1, 'Premiums reset upward across the whole book, not just the damaged part of it.'],
    ['rebuild_demand', 's_mining', 0.85, 60, 0.85, 1, 'Cement, aggregates, steel and timber demand — the largest single line in any rebuild.'],
    ['rebuild_demand', 's_consumer', 0.60, 90, 0.55, 1, 'Building-materials retail and fit-out spend.'],
    ['rebuild_demand', 'cpi_up', 0.50, 120, 0.50, 1, 'Construction cost inflation is labour-constrained and stubborn.'],
    ['rebuild_demand', 's_autos', 0.50, 60, 0.50, 1, 'Written-off vehicles are replaced in bulk.'],
    ['rebuild_demand', 's_utilities', 0.55, 120, 0.50, 1, 'Network rebuild is recoverable through the regulated asset base.'],

    /* cyber / infrastructure */
    ['cyber_infra', 'power_prices', 0.45, 2, 0.60, 1, 'Outage forces expensive replacement generation.'],
    ['cyber_infra', 'oil_spike', 0.40, 1, 0.55, 1, 'Pipeline or terminal outage tightens physical supply.'],
    ['cyber_infra', 'vol_up', 0.60, 0, 0.55, 1, 'Systemic-risk premium repriced.'],
    ['cyber_infra', 's_tech', 0.50, 10, 0.50, 1, 'Security budgets are reprioritised immediately.'],
    ['cyber_infra', 'defense_budgets', 0.45, 60, 0.50, 1, 'Cyber commands and resilience funding expand.'],

    /* freight / sanctions */
    ['freight_up', 's_shipping', 0.85, 2, 0.90, 1, 'Rates and ton-miles are the direct revenue line.'],
    ['freight_up', 'cpi_up', 0.55, 60, 0.50, 1, 'Landed cost of goods rises with a lag.'],
    ['freight_up', 's_consumer', 0.55, 60, 0.50, -1, 'Import margins compress before prices adjust.'],
    ['sanctions', 'oil_spike', 0.50, 5, 0.55, 1, 'Barrels are displaced rather than replaced.'],
    ['sanctions', 's_energy', 0.45, 10, 0.45, 1, 'Non-sanctioned producers capture the displaced demand.'],
    ['sanctions', 'capital_controls', 0.40, 30, 0.55, 1, 'Targeted economies defend the currency.'],
    ['sanctions', 'foreign_deals', 0.55, 90, 0.60, 1, 'Sanctioned trade re-routes through third countries.'],
    ['food_prices', 'cpi_up', 0.70, 30, 0.65, 1, 'Food is a heavy CPI weight in emerging markets.'],
    ['food_prices', 's_agri', 0.80, 10, 0.80, 1, 'Growers, traders and fertiliser producers capture the move.'],
    ['food_prices', 'public_anger', 0.55, 90, 0.65, 1, 'Food inflation is historically the sharpest driver of unrest.'],
    ['capital_controls', 's_banks', 0.45, 30, 0.50, -1, 'Cross-border franchises are trapped in local currency.'],
    ['vol_up', 's_crypto', 0.45, 1, 0.50, -1, 'High-beta risk assets de-gross first.'],
    ['vol_up', 's_banks', 0.40, 5, 0.35, 1, 'Trading revenue rises with volatility.'],
    ['safe_haven', 's_mining', 0.55, 5, 0.50, 1, 'Gold miners lever the metal price.'],
    ['safe_haven', 's_crypto', 0.35, 10, 0.40, 1, 'Debasement narrative competes with the liquidity drag.']
  ];

  var NODE_BY_ID = {};
  NODES.forEach(function (n) { NODE_BY_ID[n.id] = n; });
  var OUT = {}, IN = {};
  EDGES.forEach(function (e) {
    var o = { from: e[0], to: e[1], p: e[2], lag: e[3], mag: e[4], s: e[5], why: e[6] };
    (OUT[e[0]] || (OUT[e[0]] = [])).push(o);
    (IN[e[1]] || (IN[e[1]] = [])).push(o);
  });

  function seeds() { return NODES.filter(function (n) { return n.seed; }); }

  /* ---------- propagation ----------
     severity 0..1 scales edge probabilities toward certainty and amplifies magnitude.
     Returns nodes with: intensity, sign, probability, lag (days), depth and the path taken. */
  function propagate(seedId, severity, opts) {
    opts = opts || {};
    var sev = M.clamp(severity === undefined ? 0.6 : severity, 0.05, 1);
    var minP = opts.minP === undefined ? 0.10 : opts.minP;
    var maxDepth = opts.maxDepth || 6;
    var decay = opts.decay === undefined ? 0.88 : opts.decay;

    var acc = {};
    var startNode = NODE_BY_ID[seedId];
    if (!startNode) return null;
    acc[seedId] = { id: seedId, intensity: 1 * (0.5 + sev * 0.5), sign: 1, p: 1, chainP: 1, lag: 0, depth: 0, path: [seedId], via: [] };

    var frontier = [acc[seedId]];
    var visitsAllowed = {};
    for (var depth = 0; depth < maxDepth; depth++) {
      var next = [];
      frontier.forEach(function (cur) {
        (OUT[cur.id] || []).forEach(function (e) {
          /* severity pushes conditional probabilities up toward 1 */
          var pEff = M.clamp(e.p + (1 - e.p) * (sev - 0.5) * 0.85, 0.02, 0.98);
          var p = cur.p * pEff;
          if (p < minP) return;
          var intensity = cur.intensity * pEff * e.mag * decay;
          if (intensity < 0.015) return;
          var sign = cur.sign * e.s;
          var lag = cur.lag + e.lag;
          var ex = acc[e.to];
          if (!ex) {
            acc[e.to] = {
              id: e.to, intensity: intensity, sign: sign, p: p, chainP: p, lag: lag,
              depth: cur.depth + 1, path: cur.path.concat([e.to]),
              via: [{ from: cur.id, why: e.why, p: pEff, lag: e.lag, s: e.s }]
            };
            next.push(acc[e.to]);
          } else {
            /* Combine multiple routes to the same node. Independent OR-pooling would saturate
               at ~100% because these paths share upstream causes, so pool conservatively and
               cap it: a cascade is a hypothesis, not a certainty. */
            var pooled = M.clamp(Math.max(ex.p, p) + Math.min(ex.p, p) * 0.22, 0, 0.92);
            var same = Math.sign(ex.sign) === Math.sign(sign);
            ex.intensity = same ? ex.intensity + intensity * 0.55 : Math.abs(ex.intensity - intensity * 0.55);
            if (!same && intensity > ex.intensity) ex.sign = sign;
            ex.p = pooled;
            if (p > ex.chainP) { ex.chainP = p; ex.path = cur.path.concat([e.to]); }
            if (intensity > 0.6 * ex.intensity) {
              ex.via.push({ from: cur.id, why: e.why, p: pEff, lag: e.lag, s: e.s });
              if (ex.via.length > 4) ex.via.length = 4;
            }
            ex.lag = Math.min(ex.lag, lag);
            if (!visitsAllowed[e.to]) { visitsAllowed[e.to] = 1; next.push(ex); }
          }
        });
      });
      frontier = next;
      if (!frontier.length) break;
    }

    var list = Object.keys(acc).map(function (k) {
      var a = acc[k], n = NODE_BY_ID[k];
      return {
        id: k, node: n, name: n.n, kind: n.kind, sec: n.sec, px: n.px, c: n.c,
        intensity: a.intensity, sign: a.sign, p: a.p, chainP: a.chainP, lag: a.lag, depth: a.depth,
        path: a.path, via: a.via,
        score: a.intensity * a.p * a.sign
      };
    }).sort(function (x, y) { return Math.abs(y.score) - Math.abs(x.score); });

    return {
      seed: seedId, seedNode: startNode, severity: sev,
      nodes: list, byId: (function () { var m = {}; list.forEach(function (x) { m[x.id] = x; }); return m; })()
    };
  }

  /* ---------- translate a run into instrument-level expectations ---------- */
  function expressions(run, world) {
    if (!run) return { winners: [], losers: [], sectors: [], instruments: [] };
    var sectorScore = {};
    run.nodes.forEach(function (n) {
      if (n.kind === 'sector' && n.sec) {
        sectorScore[n.sec] = (sectorScore[n.sec] || 0) + n.score;
      }
    });
    /* macro nodes also imply factor pressure — map them onto industry factor exposures */
    var factors = { oil: 0, rates: 0, usd: 0, war: 0, china: 0, consumer: 0, inflation: 0 };
    var FMAP = {
      oil_spike: { oil: 1 }, gas_spike: { oil: 0.5, inflation: 0.4 }, pump_prices: { oil: 0.5, consumer: -0.3 },
      cpi_up: { inflation: 1 }, rates_higher: { rates: 1 }, usd_up: { usd: 1 },
      vol_up: { war: 0.5 }, credit_tighten: { rates: 0.5, consumer: -0.4 },
      discretionary_down: { consumer: -1 }, cost_of_living: { consumer: -0.7, inflation: 0.5 },
      elec_bills: { consumer: -0.5, inflation: 0.4 }, power_prices: { inflation: 0.4 },
      food_prices: { inflation: 0.6 }, china_demand_down: { china: -1 },
      safe_haven: { war: 0.6 }, defense_budgets: { war: 0.7 },
      battery_demand: { china: 0.3 }, grid_capex: { china: 0.2 }, freight_up: { inflation: 0.4 }
    };
    run.nodes.forEach(function (n) {
      var m = FMAP[n.id];
      if (!m) return;
      for (var k in m) factors[k] += m[k] * n.intensity * n.p * n.sign;
    });
    for (var f in factors) factors[f] = M.clamp(factors[f], -2.5, 2.5);

    var sectors = U.INDUSTRIES.map(function (ind) {
      var viaFactor = 0;
      for (var k in factors) viaFactor += (ind.exp[k] || 0) * factors[k];
      var direct = sectorScore[ind.id] || 0;
      var total = direct * 1.35 + viaFactor * 0.45;
      return {
        id: ind.id, n: ind.n, icon: ind.icon, color: ind.color,
        direct: direct, viaFactor: viaFactor, score: total,
        leaders: ind.leaders
      };
    }).sort(function (a, b) { return b.score - a.score; });

    var instruments = [];
    sectors.forEach(function (s) {
      s.leaders.forEach(function (l) {
        var prof = global.MARKET ? global.MARKET.profile(l.t) : { vol: 0.02 };
        /* expected move: score → sigma multiple → % using the name's own volatility */
        var sigmas = M.clamp(s.score * 1.5, -4, 4);
        instruments.push({
          t: l.t, n: l.n, c: l.c, sector: s.id, sectorName: s.n, color: s.color,
          score: s.score, expMovePct: sigmas * prof.vol * 100 * Math.sqrt(5),
          conf: M.clamp(Math.abs(s.score) * 0.9, 0, 0.95)
        });
      });
    });
    instruments.sort(function (a, b) { return b.score - a.score; });

    var macroPx = [];
    run.nodes.forEach(function (n) {
      if (!n.px) return;
      n.px.forEach(function (t) {
        macroPx.push({ t: t, n: (U.findEntity(t) || {}).n || t, score: n.score, sign: n.sign, p: n.p, lag: n.lag, from: n.name });
      });
    });

    return {
      factors: factors, sectors: sectors,
      winners: sectors.filter(function (s) { return s.score > 0.02; }).slice(0, 6),
      losers: sectors.filter(function (s) { return s.score < -0.02; }).sort(function (a, b) { return a.score - b.score; }).slice(0, 6),
      instruments: instruments, macroPx: macroPx
    };
  }

  /* ---------- "if X fails, what is next?" ---------- */
  function nextTargets(nodeId, severity) {
    var run = propagate(nodeId, severity === undefined ? 0.7 : severity, { maxDepth: 3, minP: 0.12 });
    if (!run) return [];
    return run.nodes.filter(function (n) { return n.id !== nodeId && n.depth > 0; })
      .slice(0, 10)
      .map(function (n) {
        return {
          id: n.id, name: n.name, kind: n.kind, p: n.p, lag: n.lag, sign: n.sign,
          why: n.via && n.via[0] ? n.via[0].why : '', depth: n.depth
        };
      });
  }

  /* ---------- chain rendering helper: the single strongest path to a node ---------- */
  function chainTo(run, targetId) {
    var t = run.byId[targetId];
    if (!t) return [];
    var sev = run.severity, cumP = 1, cumLag = 0, sign = 1;
    return t.path.map(function (id, i) {
      var n = NODE_BY_ID[id];
      var edge = null;
      if (i > 0) (OUT[t.path[i - 1]] || []).forEach(function (e) { if (e.to === id) edge = e; });
      if (edge) {
        var pEff = M.clamp(edge.p + (1 - edge.p) * (sev - 0.5) * 0.85, 0.02, 0.98);
        cumP *= pEff; cumLag += edge.lag; sign *= edge.s;
      }
      return {
        id: id, n: n.n, kind: n.kind, sign: sign,
        p: cumP,                 /* probability of this exact chain holding end to end */
        stepP: edge ? M.clamp(edge.p + (1 - edge.p) * (sev - 0.5) * 0.85, 0.02, 0.98) : 1,
        lag: cumLag, edge: edge
      };
    });
  }

  /* ---------- map an incoming story to the seeds it evidences ---------- */
  function seedsForStory(story) {
    var out = [];
    var f = story.f || {};
    var cs = story.countries || [];
    var secs = story.sectors || [];
    function add(id, w) { if (w > 0.1 && NODE_BY_ID[id]) out.push({ id: id, w: w }); }
    function has(list, arr) { return arr.some(function (x) { return list.indexOf(x) >= 0; }); }

    if (story.k === 'conflict') {
      if (has(cs, ['IR', 'IL', 'SA', 'QA', 'AE', 'IQ', 'EG', 'KW'])) add('me_conflict', 0.9);
      if (has(cs, ['TW', 'CN', 'KR', 'JP'])) add('taiwan_crisis', 0.85);
      if (has(cs, ['RU', 'UA', 'PL', 'TR'])) add('russia_escalation', 0.85);
      if (!out.length) add('me_conflict', 0.5);
    }
    if (story.k === 'energy') add('me_conflict', (f.oil || 0) > 0.4 ? 0.6 : 0.35);
    if (story.k === 'trade') add('tariff_shock', 0.85);
    if (story.k === 'supplychain') {
      /* route by what is actually constrained rather than defaulting to a rates story */
      if (has(secs, ['semis', 'tech']) || has(cs, ['TW'])) add('taiwan_crisis', 0.7);
      else if (has(secs, ['mining', 'battery', 'autos'])) add('tariff_shock', 0.6);
      else add('tariff_shock', 0.45);
    }
    if (story.k === 'monetary') add('rate_shock', (f.rates || 0) > 0.2 ? 0.85 : 0.5);
    if (story.k === 'sovereign') add('credit_event', 0.6);
    if (story.k === 'flows') add((f.rates || 0) > 0.2 ? 'rate_shock' : 'china_stimulus', 0.4);
    if (story.k === 'climate') add('nat_disaster', 0.8);
    if (story.k === 'policy') {
      if ((f.war || 0) > 0.2) add('me_conflict', 0.45);
      else if ((f.rates || 0) > 0.2) add('rate_shock', 0.45);
      else add('tariff_shock', 0.4);
    }
    if (story.k === 'corporate') {
      if (has(secs, ['semis'])) add('taiwan_crisis', 0.35);
      else if (has(secs, ['energy'])) add('me_conflict', 0.3);
      else add('tariff_shock', 0.25);
    }
    /* anything genuinely unclassifiable lands on whichever factor it moved most */
    if (!out.length) {
      var best = null, bv = 0;
      var map = { oil: 'me_conflict', war: 'me_conflict', rates: 'rate_shock',
        china: 'china_stimulus', inflation: 'rate_shock', consumer: 'rate_shock', usd: 'rate_shock' };
      for (var k in f) { if (Math.abs(f[k]) > bv) { bv = Math.abs(f[k]); best = map[k]; } }
      add(best || 'rate_shock', 0.25);
    }
    var seen = {};
    return out.sort(function (a, b) { return b.w - a.w; })
      .filter(function (x) { if (seen[x.id]) return false; seen[x.id] = 1; return true; });
  }

  global.CASCADE = {
    NODES: NODES, EDGES: EDGES, NODE_BY_ID: NODE_BY_ID, OUT: OUT, IN: IN,
    seeds: seeds, propagate: propagate, expressions: expressions,
    nextTargets: nextTargets, chainTo: chainTo, seedsForStory: seedsForStory
  };
})(window);
