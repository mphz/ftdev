var express = require('express');
var compression = require('compression');
var request = require('request');
var path = require('path');
var parser = require('body-parser');
var md5 = require('md5')
var redis = require('redis')
var mongoose = require('mongoose')
var randomstring = require('randomstring')
var ProxyLists = require('proxy-lists');
var app = express();
var client = redis.createClient(process.env.REDIS_URL);
var fs = require('fs')


/**
 * Configuration
 */
app.set('port', (process.env.PORT || 5000));
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
if (process.env.NODE_ENV == 'production') {
    app.use(function(req, res, next) {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect('https://' + req.hostname + req.url);
        }
        next();
    });
}
app.use(compression());
app.use(express.static(__dirname + '/frontend/build'));
app.use(parser.json());
app.use(parser.urlencoded({ extended: true }));


/**
 * Constant Variable
 */
SERVER = "http://api.rr.tv";
SECRET_KEY = "clientSecret=08a30ffbc8004c9a916110683aab0060";
FAKE_HEADERS = {
    "clientType": "android_RRMJ",
    "clientVersion": "3.6.3",
    "deviceId": "861134030056126",
    "token": "6b6cfdd3e90843c0a0914425638db7ef",
    "signature": "643c184f77372e364550e77adc0360cd",
    "t": "1491433993933",
    "Authentication": "RRTV 470164b995ea4aa5a53f9e5cbceded472:IxIYBj:LPWfRb:I9gvePR5R2N8muXD7NWPCj"
};

REQUEST_COUNT = 0;
PROXIES = [];
TOKENS = [];

var lineReader = require('readline').createInterface({
    input: fs.createReadStream('token.txt')
});
lineReader.on('line', function (line) {
    var s = line.trim()
    TOKENS.push(s)
});



/**
 * Get time
 */
function getDateTime() {

    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + ":" + month + ":" + day + ":" + hour + ":" + min + ":" + sec;
}


/**
 * Serve index
 */
app.get('/', function(req, res) {
    res.sendfile('index.html')
});



/**
 * getJSON as client
 *
 * url - url of api
 * body - from body data
 * callback - callback function with returning json
 * headers - headers if necessary
 */
function getJSON(url, body, callback, headers=FAKE_HEADERS) {

    // count request
    REQUEST_COUNT++;

    // change token
    FAKE_HEADERS['token'] = TOKENS[REQUEST_COUNT%TOKENS.length]


    // Change proxy every 1000 requests
    var proxy_option = {
        countries: ['us'],
        protocols: ['http']
    };
    console.log("REQUEST_COUNT: " + REQUEST_COUNT);
    if (REQUEST_COUNT % 1000 == 1) {
        // `gettingProxies` is an event emitter object.
        var gettingProxies = ProxyLists.getProxiesFromSource('freeproxylist', proxy_option);
        PROXIES = [];
        gettingProxies.on('data', function(proxies) {
            PROXIES = PROXIES.concat(proxies);
        });
        gettingProxies.on('error', function(error) {
            console.error(error);
        });
        gettingProxies.once('end', function() {
            console.log(PROXIES);
        });
    }
    
    var options = {}
    var index = 0;
    if (PROXIES.length == 0 || process.env.PROXY != 1) {
        options = {
            url : url,
            headers : headers,
            method: 'POST',
            form: body
        };
    } else {
        console.log(PROXIES.length);
        index = REQUEST_COUNT%PROXIES.length
        var proxy = PROXIES[index];
        var proxyurl = "http://" + proxy.ipAddress + ":" + proxy.port;
        console.log(proxyurl);
        options = {
            url : url,
            headers : headers,
            method: 'POST',
            form: body,
            proxy: proxyurl
        };
    }

    var buffer = "";
    var req = request(options).on('error', function(err) {
        console.log("request error: " + err);
        buffer = {code:'5000', 'msg': err};

        // update proxy list
        if (PROXIES.length > index && process.env.PROXY == 1) {
            PROXIES.splice(index, 1);
        }


    }).on('response', function(res) {
        var buffer = "";
        res.on('data', function(data) {
            buffer += data;
        }).on('end', function() {     
            callback(buffer);
            console.log(buffer);
        });
    });  
}


/**
 * cacheAndGet
 * 
 * cache is redis, if not try to get from remote
 *
 */
function cacheAndGet(key, api, body, getter, callback) {
    client.exists(key, function(err, reply) {
        if (reply === 1) {
            client.get(key, function(err, reply) {
                callback(reply);
            });
        } else {
            // Fetch remote data and set k,v in callback
            getter(api, body, function(json) {
                callback(json);
                client.set(key, json);
                // Expire after half hours
                client.expire(key, 3600);
            });
        }
    });
}


/**
 * API: Search
 *
 * {'title' : 'bigbang'}
 */
app.get('/api/search/:title', function(req, res) {
    var api = SERVER + '/v3plus/season/query'
    var body = {'name': req.params.title, 'page': '1', 'rows': '20' };
    console.log('/api/search/');

    // Check Redis and get from remote
    var key = api + JSON.stringify(req.params.title);
    cacheAndGet(key, api, body, getJSON, function(json){
        res.send(json);
    })
    
});

/**
 * API: Detail
 *
 * {'seasonId' : 1888}
 */
app.get('/api/detail/:seasonId', function(req, res) {
    var api = SERVER + '/v3plus/season/detail'
    var body = {'seasonId': req.params.seasonId}
    console.log('/api/detail/', req.params.seasonId)
   
    // Check Redis and get from remote
    var key = api + JSON.stringify(req.params.seasonId);
    cacheAndGet(key, api, body, getJSON, function(json){
        res.send(json);
    })
});


/*
 * Saving m3u8 in mongodb
 * Because rr limit requests 30times per minute.
 */
var m3u8Schema = mongoose.Schema({
    episodeSid: String,
    json: Object
});
var M3u8 = mongoose.model('m3u8', m3u8Schema);

/**
 * GetM3u8
 */
function GetM3u8(count, episodeSid, res) {
    // To avoid death loop
    if(count < 0) return;
    console.log('GetM3u8 ' + count)

    var api = SERVER + '/video/findM3u8ByEpisodeSidAuth'
    
    // calculate signature
    var headers = FAKE_HEADERS;
    var body = {}
    body['episodeSid'] = episodeSid;
    body['quality'] = 'super';
    key = 'episodeSid=' + episodeSid;
    key += 'quality=' + 'super';
    key += 'clientType=' + FAKE_HEADERS['clientType'];
    key += 'clientVersion=' + FAKE_HEADERS['clientVersion'];
    key += 't=' + FAKE_HEADERS['t'];
    key += SECRET_KEY;
    headers['signature'] = md5(key);
    body['token'] = FAKE_HEADERS['token'];
    body['seasonId'] = 0;

    // logging to debug
    console.log(md5(key))
    console.log('/api/m3u8/', episodeSid)

    // Fetch remote data and set k,v in callback
    getJSON(api, body, function(json) {
        var valid = true;
        try {
            var obj = JSON.parse(json);
        } catch (e) {
            valid = false;
        }

        if (valid && obj.code != "1024") {
            // success
            res.send(json);
            console.log(json)
            client.set(key, json);
            client.expire(key, 3500);
        } else {
            
            GetM3u8(count, episodeSid, res);
        }
    }, headers); 
}

/**
 * GetToken
 */
function GetToken(callback) {
    console.log('GetToken');
    var api = SERVER + '/user/platLogin'

    var headers = FAKE_HEADERS;
    var body = {}
    var name = randomstring.generate(8)
    body['usid'] = '123123123123331222'
    if (process.env.usid != null) {
        body['usid'] = process.env.usid
    }
    body['platformName'] = 'sina'
    body['nickName'] = name
    body['userName'] = '123123123123331222'
    body['securityCode'] = ''

    // Record token change 
    client.set('tokenChange - ' + getDateTime(), 1);

    getJSON(api, body, function(json) {
        console.log("GetToken: " + json);
        var valid = true;
        try {
            var obj = JSON.parse(json);
        } catch (e) {
            valid = false;
        }

        if (valid && obj.code == '0000') {
            if(obj.data !== undefined &&
                obj.data.user !== undefined &&
                obj.data.user.token !== undefined)
            FAKE_HEADERS['token'] = obj.data.user.token;
        }
        callback();
    })
}

/**
 * API: M3u8
 *
 * {'episodeSid' : 25005, 'quality' : 'super'}
 */
app.get('/api/m3u8/:episodeSid', function(req, res) {
    var api = SERVER + '/video/findM3u8ByEpisodeSid'
    // Check Redis cache first
    var key = api + JSON.stringify(req.params.episodeSid);

    client.exists(key, function(err, reply) {
        if (reply === 1) {
            client.get(key, function(err, reply) {
                res.send(reply);
            });
        } else {

                GetM3u8(3, req.params.episodeSid, res);
            
        }
    });
});

/**
 * API: latest
 *
 */
 app.get('/api/latest', function(req, res) {
    var api = SERVER + '/v3plus/season/usk/index'
    var body = {'page':'1', 'rows':'20'}
    console.log('/api/index');

    // Check Redis and get from remote
    var key = api;
    cacheAndGet(key, api, body, getJSON, function(json){
        res.send(json);
    })
 });

/**
 * API: Index
 *
 */
 app.get('/api/index', function(req, res) {
    var api = SERVER + '/v3plus/video/indexInfo'
    var body = {}
    console.log('/api/index');

    // Check Redis and get from remote
    var key = api;
    cacheAndGet(key, api, body, getJSON, function(json){
        res.send(json);
    })
 });

 /**
 * API: hot
 *
 */
 app.get('/api/hot', function(req, res) {
    var api = SERVER + '/video/seasonRankingList'
    var body = {}
    console.log('/api/hot');

    // Check Redis and get from remote
    var key = api;
    cacheAndGet(key, api, body, getJSON, function(json){
        res.send(json);
    })
 });

 /**
 * API: top
 *
 */
 app.get('/api/top', function(req, res) {
    var api = SERVER + '/v3plus/season/topList'
    var body = {}
    console.log('/api/top');

    // Check Redis and get from remote
    var key = api;
    cacheAndGet(key, api, body, getJSON, function(json){
        res.send(json);
    });
 });

 /**
 * API: album
 *
 */
 app.get('/api/album/:albumId', function(req, res) {
    var api = SERVER + '/v3plus/video/album'
    var body = {'albumId': req.params.albumId}
    console.log('/api/album');

    // Check Redis and get from remote
    var key = api + JSON.stringify(req.params.albumId);
    cacheAndGet(key, api, body, getJSON, function(json){
        res.send(json);
    });
 });

 /**
 * API: category
 *
 */
 app.get('/api/category/:categoryType/:pages', function(req, res) {
    var api = SERVER + '/video/search'
    var body = {'name': 'cat_list', 
                       'cat': req.params.categoryType, 
                       'page': req.params.pages};
    console.log('/api/category');

    // Check Redis and get from remote
    var key = api + JSON.stringify(req.params.categoryType) + JSON.stringify(req.params.pages) ;
    cacheAndGet(key, api, body, getJSON, function(json){
        res.send(json);
    });
 });

/**
 * API: get Metrics
 */
 app.get('/api/metrics', function(req, res) {
    
 })

/**
 *
 */
app.get('/api/flushdb', function(req, res) {
  client.flushdb( function (err, succeeded) {
    res.send('flush success');
  });
})


/**
 * wildcard
 */
app.get('*', function (request, response){
  console.log(path.resolve(__dirname, 'frontend/build', 'index.html'));
  response.sendFile(path.resolve(__dirname, 'frontend/build', 'index.html'))
})


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


