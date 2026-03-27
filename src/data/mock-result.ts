import type { AnalysisResult } from "@/types";

export const MOCK_RESULT: AnalysisResult = {
  mock: true,
  incident_text: "",
  agent_results: [
    {
      agent: "causal_analyst",
      agent_summary:
        "The deployment of rc1 at 14:02 is the most likely initiating trigger. The new_retries feature flag, enabled at 14:04:16, amplified an already degraded database connection pool into a full retry storm, cascading into deadlocks and checkout unavailability.",
      top_hypotheses: [
        {
          title: "Feature flag new_retries triggered retry storm on degraded DB",
          confidence: 0.82,
          causal_chain: [
            "Deploy rc1 started (14:02:11)",
            "Cache miss ratio spiked to 71% — likely cache invalidation on deploy",
            "DB CPU hit 92%, connections near limit (14:03:20)",
            "new_retries flag enabled 100% (14:04:16)",
            "Retry storm amplified load on exhausted DB",
            "Deadlocks reached 37 rollbacks (14:04:03)",
            "Circuit breaker opened (14:05:33)",
            "Checkout availability dropped to 61%",
          ],
          evidence: [
            "14:02:11 deploy-service INFO Release 2026.03.27-rc1 started",
            "14:03:12 billing-service INFO Cache miss ratio jumped from 12% to 71%",
            "14:03:20 db-primary WARN CPU 92% connections 480/500",
            "14:04:16 feature-flag INFO Flag \"new_retries\" enabled for 100% traffic",
            "14:03:41 worker-queue WARN Retry storm detected",
          ],
          assumptions: [
            "rc1 introduced cache invalidation logic",
            "new_retries flag was not tested under DB pressure",
            "Retry backoff was insufficient or absent",
          ],
          next_checks: [
            "Review rc1 diff for cache invalidation changes",
            "Check new_retries flag retry interval and max attempt config",
            "Confirm whether retry storm started before or after flag enablement",
          ],
        },
        {
          title: "Cache stampede from deploy caused DB saturation independently",
          confidence: 0.61,
          causal_chain: [
            "Deploy invalidated large cache segment",
            "All requests simultaneously hit DB (stampede)",
            "DB connections exhausted",
            "Deadlocks and timeouts followed",
          ],
          evidence: [
            "14:03:12 cache miss ratio jumped from 12% to 71%",
            "14:03:20 DB CPU 92%",
            "14:03:05 api-gateway WARN upstream timeout",
          ],
          assumptions: [
            "No staggered cache warm-up was configured",
            "DB was already near capacity before deploy",
          ],
          next_checks: [
            "Check DB connection count trend before 14:02",
            "Verify cache warm-up strategy in rc1",
          ],
        },
      ],
    },
    {
      agent: "skeptic",
      agent_summary:
        "The deploy is a convenient scapegoat, but the DB was already showing stress before the feature flag fired. The duplicate charge reports suggest the retry logic may be a pre-existing bug surfaced by load, not a new introduction in rc1.",
      top_hypotheses: [
        {
          title: "DB was already near saturation before deploy — deploy is coincidental",
          confidence: 0.58,
          causal_chain: [
            "DB was trending toward saturation (missing pre-deploy baseline)",
            "Deploy coincided with peak traffic",
            "Cache miss spike is correlated but not necessarily caused by deploy",
          ],
          evidence: [
            "No pre-deploy DB baseline shown in logs",
            "14:03:05 timeout to billing-service occurred only 54 seconds after deploy — very fast for a cache invalidation effect",
          ],
          assumptions: [
            "We do not have DB metrics before 14:02",
            "Cache invalidation typically takes longer to propagate fully",
          ],
          next_checks: [
            "Pull DB CPU/connection metrics for 13:30–14:02 window",
            "Check traffic volume around 14:02 for independent spike",
          ],
        },
        {
          title: "Duplicate charges suggest retry bug predates rc1",
          confidence: 0.47,
          causal_chain: [
            "Duplicate charge pattern requires non-idempotent retry logic",
            "Idempotency keys should prevent this — their absence is pre-existing",
            "rc1 may have increased retry frequency but the bug is older",
          ],
          evidence: [
            "14:04:52 oncall-note INFO Customers report duplicate charge attempts",
            "Duplicate charges require idempotency failure — not a cache or DB CPU issue",
          ],
          assumptions: [
            "Billing service lacked idempotency keys before rc1",
          ],
          next_checks: [
            "Audit billing-service idempotency key implementation history",
            "Check prior incident reports for similar duplicate charge patterns",
          ],
        },
      ],
    },
    {
      agent: "pattern_matcher",
      agent_summary:
        "This incident strongly matches a Retry Storm / Connection Pool Exhaustion cascade, a well-documented distributed systems failure archetype. Secondary signals also match a Cache Stampede pattern from the deploy event.",
      top_hypotheses: [
        {
          title: "Retry Storm → Connection Pool Exhaustion cascade",
          confidence: 0.88,
          causal_chain: [
            "Upstream latency increases → clients retry",
            "Retries amplify load on already-degraded dependency",
            "Connection pool exhausted → deadlocks",
            "Circuit breaker opens as last resort",
            "Availability collapses",
          ],
          evidence: [
            "14:03:41 worker-queue WARN Retry storm detected",
            "14:03:20 db-primary connections 480/500",
            "14:04:03 billing-service deadlock count=37",
            "14:05:33 circuit breaker opened",
          ],
          assumptions: [
            "No exponential backoff with jitter was configured",
            "No per-client connection limits were enforced",
          ],
          next_checks: [
            "Confirm retry policy lacks jitter/backoff",
            "Check if circuit breaker thresholds were appropriate",
            "Review connection pool sizing vs expected peak load",
          ],
        },
        {
          title: "Cache Stampede from deploy invalidation",
          confidence: 0.74,
          causal_chain: [
            "Deploy triggers mass cache invalidation",
            "All callers simultaneously miss cache",
            "Thundering herd hits DB",
            "DB saturates",
          ],
          evidence: [
            "14:03:12 cache miss ratio 12% → 71% over 7 seconds",
          ],
          assumptions: [
            "Cache TTL or invalidation was deploy-triggered",
          ],
          next_checks: [
            "Check if cache invalidation is scoped or full-flush on deploy",
            "Consider probabilistic early expiration or request coalescing",
          ],
        },
      ],
    },
    {
      agent: "impact_analyzer",
      agent_summary:
        "Immediate risk is customer-facing revenue loss and potential duplicate billing. The circuit breaker has bought time but checkout availability at 61% is critical. Without intervention, DB replication lag and connection exhaustion will worsen within minutes.",
      top_hypotheses: [
        {
          title: "Full checkout outage within 10–15 minutes without DB relief",
          confidence: 0.79,
          causal_chain: [
            "DB replication lag at 14s and growing (14:05:10)",
            "Circuit breaker open means no writes to primary — read replica becoming stale",
            "Stale reads will trigger more client retries",
            "Retry volume will sustain load even without new traffic",
            "Checkout availability will continue declining from 61%",
          ],
          evidence: [
            "14:05:10 db-replica WARN replication lag 14s",
            "14:05:33 circuit breaker opened to db-primary",
            "14:05:58 checkout availability 61%",
          ],
          assumptions: [
            "No auto-scaling or read replica promotion is configured",
            "Retry storm has not yet been rate-limited",
          ],
          next_checks: [
            "Immediately disable new_retries flag or reduce retry rate",
            "Drain worker-queue retry jobs",
            "Consider emergency traffic shedding on checkout endpoint",
          ],
        },
        {
          title: "Duplicate charge exposure will expand until idempotency is enforced",
          confidence: 0.72,
          causal_chain: [
            "Duplicate charges already reported at 14:04:52",
            "Each retry without idempotency key creates a new charge attempt",
            "Until retries stop or idempotency is enforced, more duplicates accumulate",
          ],
          evidence: [
            "14:04:52 oncall-note INFO Customers report duplicate charge attempts",
            "14:03:41 retry storm active",
          ],
          assumptions: [
            "Billing service does not deduplicate by transaction ID in current state",
          ],
          next_checks: [
            "Halt payment reconciliation job retries immediately",
            "Audit billing DB for duplicate transaction entries since 14:03",
            "Prepare customer refund runbook",
          ],
        },
      ],
    },
  ],
  disagreements: [
    {
      topic: "Root cause: deploy vs pre-existing DB saturation",
      agents_in_conflict: ["causal_analyst", "skeptic"],
      conflict_description:
        "Causal Analyst assigns the deploy (rc1 + new_retries flag) as the primary cause. The Skeptic argues DB saturation may have been trending before the deploy, making the deploy coincidental rather than causal.",
      disagreement_score: 0.71,
      resolution_suggestion:
        "Pull DB CPU and connection metrics for the 30 minutes before 14:02. A flat baseline confirms the deploy caused the spike; a rising baseline supports the Skeptic.",
    },
    {
      topic: "Duplicate charges: new bug vs pre-existing idempotency failure",
      agents_in_conflict: ["causal_analyst", "skeptic"],
      conflict_description:
        "Causal Analyst treats duplicate charges as a downstream effect of the retry storm introduced in rc1. The Skeptic argues idempotency failure is a pre-existing architectural gap that rc1 merely surfaced.",
      disagreement_score: 0.63,
      resolution_suggestion:
        "Check billing-service idempotency key implementation history and prior incident records for any earlier duplicate charge reports.",
    },
    {
      topic: "Urgency: checkout outage vs duplicate charge exposure",
      agents_in_conflict: ["impact_analyzer", "pattern_matcher"],
      conflict_description:
        "Impact Analyzer prioritizes halting checkout degradation imminently. Pattern Matcher focuses on the retry configuration as the single fix point. They imply different first actions.",
      disagreement_score: 0.44,
      resolution_suggestion:
        "Both actions are non-conflicting. Disable new_retries flag first (stops amplification), then address checkout traffic shedding as a parallel action.",
    },
  ],
  final_hypotheses: [
    {
      title: "Retry storm triggered by new_retries flag on a cache-stampede-degraded DB",
      confidence_mean: 0.83,
      confidence_variance: 0.02,
      supporting_agents: ["causal_analyst", "pattern_matcher", "impact_analyzer"],
      evidence_count: 7,
      source_diversity: 4,
      contradiction_rate: 0.18,
      blast_radius: "high",
      reversibility: "moderate",
      time_criticality: "minutes",
      decision_priority: 0.94,
      causal_chain: [
        "Deploy rc1 → cache invalidation",
        "Cache stampede → DB CPU 92%, connections 480/500",
        "new_retries flag enabled 100% → retry storm amplified",
        "Deadlocks → circuit breaker open",
        "Checkout availability 61% and declining",
      ],
    },
    {
      title: "Cache stampede from deploy caused DB saturation independently",
      confidence_mean: 0.67,
      confidence_variance: 0.05,
      supporting_agents: ["causal_analyst", "pattern_matcher"],
      evidence_count: 4,
      source_diversity: 2,
      contradiction_rate: 0.28,
      blast_radius: "high",
      reversibility: "easy",
      time_criticality: "minutes",
      decision_priority: 0.71,
      causal_chain: [
        "Deploy invalidated large cache segment",
        "Thundering herd hit DB simultaneously",
        "DB connections exhausted → deadlocks",
      ],
    },
    {
      title: "Duplicate charges from pre-existing idempotency gap amplified by retry storm",
      confidence_mean: 0.59,
      confidence_variance: 0.08,
      supporting_agents: ["skeptic", "impact_analyzer"],
      evidence_count: 3,
      source_diversity: 2,
      contradiction_rate: 0.41,
      blast_radius: "medium",
      reversibility: "hard",
      time_criticality: "hours",
      decision_priority: 0.55,
      causal_chain: [
        "Pre-existing absent idempotency keys in billing-service",
        "Retry storm generated repeated charge attempts",
        "Customer-facing duplicate charges accumulating",
      ],
    },
  ],
  decision_signals: [
    {
      label: "Highest-confidence hypothesis",
      value: "Retry storm + cache stampede cascade",
      interpretation: "Act on this first.",
    },
    {
      label: "Top disagreement zone",
      value: "Deploy vs pre-existing DB saturation (score 0.71)",
      interpretation: "Investigate before assigning blame or rolling back.",
    },
    {
      label: "Time criticality",
      value: "Minutes",
      interpretation: "Disable new_retries flag immediately.",
    },
    {
      label: "Blast radius",
      value: "High — checkout + billing + DB + customers",
      interpretation: "All-hands incident. Escalate now.",
    },
    {
      label: "Reversibility of top hypothesis",
      value: "Moderate",
      interpretation: "Flag disable is fast; DB recovery and duplicate charge cleanup will take longer.",
    },
    {
      label: "Evidence coverage",
      value: "7 distinct signals across 4 source types",
      interpretation: "Good coverage. Key gap: no pre-deploy DB baseline.",
    },
  ],
};
