import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

dotenv.config();

const BASE_URL = process.env.DASHBOARD_BASE_URL || 'http://localhost:4000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.ADMIN_DASHBOARD_TOKEN;

const PERIODS = [
  'current_month',
  'last_month',
  'last_3_months',
  'last_6_months',
  'this_year',
  'all_time'
];

const OUTPUT_FILE = 'test_output.txt';

if (!ADMIN_TOKEN) {
  console.error('❌ ADMIN_TOKEN (or ADMIN_DASHBOARD_TOKEN) env variable not set');
  process.exit(1);
}

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${ADMIN_TOKEN}`
  },
  timeout: 30000
});

function log(line) {
  fs.appendFileSync(OUTPUT_FILE, line + '\n', 'utf8');
  console.log(line);
}

async function fetch(path, params = {}) {
  const url = `/api/admin/dashboard${path}`;
  const res = await client.get(url, { params });
  return res.data;
}

function almostEqual(a, b, tolerance = 1e-6) {
  return Math.abs(a - b) <= tolerance;
}

async function runForPeriod(period) {
  log('='.repeat(80));
  log(`🔎 Period: ${period}`);

  const [
    summary,
    revenue,
    overview,
    breakdown,
    topStarsIncome,
    serviceVideoCall,
    serviceLiveShow,
    serviceDedication,
    costEvaluation
  ] = await Promise.all([
    fetch('/summary', { period }),
    fetch('/revenue', { period }),
    fetch('/overview', { period }),
    fetch('/service-revenue-breakdown', { period }),
    fetch('/top-stars-list', { period, filter: 'income' }),
    fetch('/service-insights/video-call', { period }),
    fetch('/service-insights/live-show', { period }),
    fetch('/service-insights/dedication', { period }),
    fetch('/cost-evaluation', { period })
  ]);

  const revTotal = revenue.data.totalRevenue || 0;
  const revEscrow = revenue.data.escrowAmount || 0;

  const overviewTotal = overview.data.revenue.totalRevenue || 0;
  const overviewEscrow = overview.data.revenue.escrowAmount || 0;

  const serviceRevSum = (breakdown.data.serviceRevenue || []).reduce(
    (sum, srv) => sum + (srv.revenue || 0),
    0
  );

  const topStarsIncomeSum = (topStarsIncome.data.stars || []).reduce(
    (sum, s) => sum + (s.totalIncome || 0),
    0
  );

  // Extract service-wise revenue from breakdown and overview
  const breakdownMap = {};
  (breakdown.data.serviceRevenue || []).forEach((srv) => {
    breakdownMap[srv.service] = srv.revenue || 0;
  });

  const ovService = overview.data.revenue.serviceBreakdown || {};

  const videoCallRevenueBreakdown = breakdownMap['Video Calls'] || 0;
  const liveShowRevenueBreakdown = breakdownMap['Live Show'] || 0;
  const dedicationRevenueBreakdown = breakdownMap['Dedication'] || 0;

  const videoCallRevenueOverview = ovService.videoCall || 0;
  const liveShowRevenueOverview = ovService.liveShow || 0;
  const dedicationRevenueOverview = ovService.dedication || 0;

  const videoCallRevenueService = serviceVideoCall.data.netRevenue || 0;
  const liveShowRevenueService = serviceLiveShow.data.netRevenue || 0;
  const dedicationRevenueService = serviceDedication.data.netRevenue || 0;

  // Cost evaluation minutes
  const ceVideoMinutes = costEvaluation.data.videoCalls?.minutes ?? 0;
  const ceLiveMinutes = costEvaluation.data.liveShow?.minutes ?? 0;
  const ceDedicationMinutes = costEvaluation.data.dedication?.minutes ?? 0;

  const ovCost = overview.data.costEvaluation || {};
  const ovVideoMinutes = ovCost.videoCall?.minutes ?? 0;
  const ovLiveMinutes = ovCost.liveShow?.minutes ?? 0;
  const ovDedicationMinutes = ovCost.dedication?.minutes ?? 0;

  log(`Revenue.totalRevenue          : ${revTotal}`);
  log(`Overview.revenue.totalRevenue : ${overviewTotal}`);
  log(`Service breakdown sum         : ${serviceRevSum}`);
  log(`Top stars income sum          : ${topStarsIncomeSum}`);
  log(`Revenue.escrowAmount          : ${revEscrow}`);
  log(`Overview.revenue.escrowAmount : ${overviewEscrow}`);
  log(`VideoCall revenue - breakdown / overview / service-insights : ${videoCallRevenueBreakdown} / ${videoCallRevenueOverview} / ${videoCallRevenueService}`);
  log(`LiveShow revenue  - breakdown / overview / service-insights : ${liveShowRevenueBreakdown} / ${liveShowRevenueOverview} / ${liveShowRevenueService}`);
  log(`Dedication revenue- breakdown / overview / service-insights : ${dedicationRevenueBreakdown} / ${dedicationRevenueOverview} / ${dedicationRevenueService}`);
  log(`VideoCall minutes - cost-eval / overview                    : ${ceVideoMinutes} / ${ovVideoMinutes}`);
  log(`LiveShow minutes  - cost-eval / overview                    : ${ceLiveMinutes} / ${ovLiveMinutes}`);
  log(`Dedication minutes- cost-eval / overview                    : ${ceDedicationMinutes} / ${ovDedicationMinutes}`);

  const mismatches = [];

  if (!almostEqual(revTotal, overviewTotal)) {
    mismatches.push('totalRevenue (revenue vs overview)');
  }
  if (!almostEqual(revTotal, serviceRevSum)) {
    mismatches.push('totalRevenue (revenue vs service breakdown sum)');
  }
  if (!almostEqual(revEscrow, overviewEscrow)) {
    mismatches.push('escrowAmount (revenue vs overview)');
  }

  // Service-wise revenue consistency
  if (
    !almostEqual(videoCallRevenueBreakdown, videoCallRevenueOverview) ||
    !almostEqual(videoCallRevenueBreakdown, videoCallRevenueService)
  ) {
    mismatches.push('videoCall revenue (breakdown vs overview vs service-insights)');
  }
  if (
    !almostEqual(liveShowRevenueBreakdown, liveShowRevenueOverview) ||
    !almostEqual(liveShowRevenueBreakdown, liveShowRevenueService)
  ) {
    mismatches.push('liveShow revenue (breakdown vs overview vs service-insights)');
  }
  if (
    !almostEqual(dedicationRevenueBreakdown, dedicationRevenueOverview) ||
    !almostEqual(dedicationRevenueBreakdown, dedicationRevenueService)
  ) {
    mismatches.push('dedication revenue (breakdown vs overview vs service-insights)');
  }

  // Cost evaluation minutes consistency
  if (!almostEqual(ceVideoMinutes, ovVideoMinutes)) {
    mismatches.push('videoCall minutes (cost-evaluation vs overview)');
  }
  if (!almostEqual(ceLiveMinutes, ovLiveMinutes)) {
    mismatches.push('liveShow minutes (cost-evaluation vs overview)');
  }
  if (!almostEqual(ceDedicationMinutes, ovDedicationMinutes)) {
    mismatches.push('dedication minutes (cost-evaluation vs overview)');
  }

  // Summary vs overview summary for newUsers / engagedFans
  const summaryNew = summary.data.newUsers;
  const summaryEngaged = summary.data.engagedFans;

  const overviewNew = overview.data.summary.newUsers.count;
  const overviewEngaged = overview.data.summary.engagedFans.count;

  log(`Summary.newUsers              : ${summaryNew}`);
  log(`Overview.summary.newUsers     : ${overviewNew}`);
  log(`Summary.engagedFans           : ${summaryEngaged}`);
  log(`Overview.summary.engagedFans  : ${overviewEngaged}`);

  if (summaryNew !== overviewNew) {
    mismatches.push('newUsers (summary vs overview)');
  }
  if (summaryEngaged !== overviewEngaged) {
    mismatches.push('engagedFans (summary vs overview)');
  }

  if (mismatches.length === 0) {
    log(`✅ Period ${period}: ALL CHECKS PASSED`);
  } else {
    log(`❌ Period ${period}: MISMATCHES -> ${mismatches.join(', ')}`);
  }
}

async function main() {
  fs.writeFileSync(OUTPUT_FILE, '', 'utf8'); // clear previous output
  log('Admin Dashboard Verification Report');
  log(`Base URL : ${BASE_URL}`);
  log('');

  for (const period of PERIODS) {
    try {
      await runForPeriod(period);
    } catch (err) {
      log(`❌ Period ${period}: ERROR -> ${err.message}`);
    }
  }

  log('');
  log('Verification finished. See details above.');
}

main().catch((err) => {
  console.error('Fatal error in verification script:', err);
  process.exit(1);
});

