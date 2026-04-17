/**
 * Circuit Breaker Pattern for Exchange Connectivity
 * Prevents continuous API failures from overwhelming the system.
 */
export class CircuitBreaker {
    constructor(name, options = {}) {
        this.name = name;
        this.threshold = options.threshold || 5; // failures before opening
        this.resetTimeout = options.resetTimeout || 60000; // time to wait before half-open (1 min)
        
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failures = 0;
        this.lastFailureTime = 0;
    }

    recordSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    recordFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
            console.warn(`🚨 [CircuitBreaker] ${this.name} is now OPEN (Threshold hit)`);
        }
    }

    shouldAllowRequest() {
        if (this.state === 'CLOSED') return true;
        
        if (this.state === 'OPEN') {
            const now = Date.now();
            if (now - this.lastFailureTime > this.resetTimeout) {
                this.state = 'HALF_OPEN';
                console.info(`🔄 [CircuitBreaker] ${this.name} is now HALF_OPEN (Reset timeout passed)`);
                return true;
            }
            return false;
        }

        // HALF_OPEN allows requests to test the service
        return true;
    }

    getState() {
        return this.state;
    }
}
