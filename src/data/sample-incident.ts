export const SAMPLE_INCIDENT = `14:02:11 deploy-service INFO Release 2026.03.27-rc1 started
14:03:05 api-gateway WARN Upstream timeout to billing-service p95=1800ms
14:03:12 billing-service INFO Cache miss ratio jumped from 12% to 71%
14:03:20 db-primary WARN CPU 92% connections 480/500
14:03:26 api-gateway ERROR 502 rate increased to 18%
14:03:41 worker-queue WARN Retry storm detected on payment reconciliation jobs
14:04:03 billing-service ERROR Deadlock detected transaction rollback count=37
14:04:16 feature-flag INFO Flag "new_retries" enabled for 100% traffic
14:04:30 api-gateway ERROR 502 rate increased to 34%
14:04:52 oncall-note INFO Customers report duplicate charge attempts
14:05:10 db-replica WARN replication lag 14s
14:05:33 billing-service WARN circuit breaker opened to db-primary
14:05:58 api-gateway ERROR checkout endpoint availability 61%`;
