
var SockJSSocket = Class.extend({
    init: function(endpoint, options){
        this.endpoint = endpoint;
        this.options = $.extend({
            debug: false,
            auto_reconnect: true,
            connect_timeout: 10000,
            ping_timeout: 8000,
            max_reconnect_delay: 10000,
            add_random_delay: 4000
        }, options);
        
        this.status = 'disconnected';
    
        this.callbacks = {};
    },
    on: function(key, callback) {
        if (typeof this.callbacks[key] == 'undefined') {
            this.callbacks[key] = [];
        }
    
        this.callbacks[key].push(callback);
    },
    fire: function() {
        var callbacks = this.callbacks[arguments[0]];
    
        if (typeof callbacks == 'undefined') {
            return
        }
    
        var args = [];
        for (var i=1; i<arguments.length; i++) {
            args[i-1] = arguments[i]; 
        }
    
        for (var i=0; i<callbacks.length;i++) {
            callbacks[i].apply(this, args);
        }
    },
    connect: function(reconnecting){
    
        if(this.status != 'disconnected'){
            this.disconnected(true);
        }
        
        this.enable_reconnect = this.options.auto_reconnect;
    
        if (reconnecting) {
            this.connect_attempts++;
            this.log("Re-connecting... [Attempt #" + this.connect_attempts + "]");
        } else {
            this.log("Connecting...");
            this.connect_attempts = 0;
        }
        this.status = 'connecting';
    
        if (typeof this.connectTimeout != 'undefined') {
            clearTimeout(this.connectTimeout);
            delete this.connectTimeout;
        }
        if (typeof this.timeoutInterval != 'undefined') {
            this.log('timeout interval cleared in connect');
            clearInterval(this.timeoutInterval);
            delete this.timeoutInterval;
        }
    
        this.sock = new SockJS(this.endpoint);
        
    
        this.lastSeen = new Date();
    
        var self = this;
    
        this.sock.onclose = function() {
            self.handleClose();
        }
    
        this.sock.onmessage = function(e) {
            var obj = JSON.parse(e.data.toString());
            self.handleMessage(obj);
        };
    
        this.connectTimeout = setTimeout(function() {
            self.disconnected();
        }, this.options.connect_timeout);
    
        this.sock.onopen = function() {
            self.handleConnected();
        };
    },
    handleClose: function() {
        this.log("Disconnected");
        this.status = 'disconnected';
        this.fire('disconnect');
        
        if (typeof this.timeoutInterval != 'undefined') {
            this.log('timeout interval cleared in handleClose');
            clearInterval(this.timeoutInterval);
            delete this.timeoutInterval;
        }
        
        if (this.enable_reconnect) {
            this.reconnect();
        }
    },
    handleConnected: function() {
        this.connect_attempts = 0; // reset connect attempts.
        
        clearTimeout(this.connectTimeout);
    
        var self = this;
    
        this.timeoutInterval = setInterval(function(){
            if (new Date().getTime() - self.lastSeen.getTime() > 9000) {
                self.disconnected();
            }
        }, this.options.ping_timeout);
        this.log('Timeout interval created');
    
        this.log("Connected");
        this.status = 'connected';
        this.fire('connect');
    },
    handleMessage: function(obj) {
        if (obj['system'] == '1') {
            this.lastSeen = new Date();
            this.sock.send(JSON.stringify({
                system: '1', 
                payload: obj.payload
            }));
        } else {
            this.fire('message', obj['payload']);
        }
    },
    disconnect: function() {
        this.disconnected(true);
    },
    disconnected: function(noReconnect) {
        if (noReconnect) {
            this.enable_reconnect = false;
        } else {
            this.enable_reconnect = this.options.auto_reconnect;
        }
        this.status = 'disconnected';
        this.sock.close();
    },
    reconnect: function() {
        var self =  this;
        if (typeof this.reconnectTime != 'undefined') {
            return;
        }
    
        var reconnectIn = Math.min(this.options.max_reconnect_delay, 2000 * this.connect_attempts) + (this.options.add_random_delay*Math.random());
        this.reconnectTimeout = setTimeout(function() {
            self.connect(true);
            delete self.reconnectTimeout;
        }, reconnectIn);
        this.log('Re-connecting in ' + reconnectIn + 'ms');
    },
    send: function(obj){
        if (typeof this.sock == 'undefined') {
            return;
        }
        this.sock.send(JSON.stringify({
            system: '0', 
            payload: obj
        }));
    },
    log: function(message) {
        if (this.options.debug) {
            console.log("Sock: " + message);
        }
    }
});
