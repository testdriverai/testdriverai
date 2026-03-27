const Sentry = require('@sentry/node');
const crypto = require('crypto');

Sentry.init({ dsn: 'https://test@sentry.io/123', tracesSampleRate: 1.0 });

const sessionId = 'test-session-123';
const traceId = crypto.createHash('md5').update(sessionId).digest('hex');
console.log('expected traceId:', traceId);

const sentryTraceHeader = traceId + '-' + crypto.randomBytes(8).toString('hex') + '-1';
const baggageHeader = 'sentry-trace_id=' + traceId + ',sentry-sampled=true';

// Approach: Use continueTrace + startInactiveSpan for the root, then rely on scope
// for getTraceData propagation
Sentry.continueTrace(
  { sentryTrace: sentryTraceHeader, baggage: baggageHeader },
  () => {
    // This sets propagation context on the current scope
    const rootSpan = Sentry.startInactiveSpan({ name: 'sdk.session', op: 'session', forceTransaction: true });
    
    // After continueTrace returns, check if getTraceData still uses the right traceId
    const td = Sentry.getTraceData();
    console.log('after continueTrace getTraceData:', JSON.stringify(td));
    console.log('traceId matches:', td['sentry-trace'] && td['sentry-trace'].startsWith(traceId));
    
    // Simulate async: do a child span later
    setTimeout(() => {
      const td2 = Sentry.getTraceData();
      console.log('async getTraceData:', JSON.stringify(td2));
      console.log('async traceId matches:', td2['sentry-trace'] && td2['sentry-trace'].startsWith(traceId));
      rootSpan.end();
      process.exit(0);
    }, 100);
  }
);
