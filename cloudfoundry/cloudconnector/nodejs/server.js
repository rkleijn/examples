const axios = require('axios')
var hana = require('@sap/hana-client');
const express = require('express')
const app = express()

const VCAP_SERVICES = JSON.parse(process.env.VCAP_SERVICES);
const conSrvCred = VCAP_SERVICES.connectivity[0].credentials;

app.listen(process.env.PORT, function () {
    console.log('CloudToOnprem application started')
})

app.get('/callonprem', async function (req, res) {
    // Call to on onPrem via SCC utilizing socks5 proxy port
    try {
        const connJwtToken = await _fetchJwtToken(conSrvCred.token_service_url, conSrvCred.clientid, conSrvCred.clientsecret);
        const result = await _callOnPremSql(conSrvCred.onpremise_proxy_host, conSrvCred.onpremise_socks5_proxy_port, connJwtToken);
        res.json(result);
    } catch (e) {
        res.json({ 'msg': JSON.stringify(e)});
    } finally {
        res.json({ 'msg': 'This is not a good sign'});
    }
});

app.get('/callonpremhttp', async function (req, res) {
    // Call to on onPrem via SCC utilizing http proxy port
    try {
        const connJwtToken = await _fetchJwtToken(conSrvCred.token_service_url, conSrvCred.clientid, conSrvCred.clientsecret);
        const result =  await _callOnPremHttp(conSrvCred.onpremise_proxy_host, conSrvCred.onpremise_proxy_http_port, connJwtToken);
        res.json(result);
    } catch (e) {
        res.json({ 'msg': JSON.stringify(e)});
    } finally {
        res.json({ 'msg': 'This is not a good sign'});
    }
    
});

const _fetchJwtToken = async function(oauthUrl, oauthClient, oauthSecret) {
	return new Promise ((resolve, reject) => {
		const tokenUrl = oauthUrl + '/oauth/token?grant_type=client_credentials&response_type=token'  
        const config = {
			headers: {
			   Authorization: "Basic " + Buffer.from(oauthClient + ':' + oauthSecret).toString("base64")
			}
        }
		axios.get(tokenUrl, config)
        .then(response => {
		   resolve(response.data.access_token)
        })
        .catch(error => {
		   reject(error)
        })
	})   
}

// SQL _onCallOnPrem
const _callOnPremSql = async function(connProxyHost, connProxyPort, connJwtToken){
    return new Promise ((resolve, reject) => {
    	// Quick explanation of parameters used:
    	// serverNode: Is the virtual host/port configured in SCC
    	// UID: db userid
    	// PWD: db password
    	// proxyHostname: SCP/BTP proxy required to access SCC
    	// proxyPort: SCP/BTP proxy port required to access SCC (needs to be socks5 port for SQLDBC)
    	// sslValidateCertificate: Enable validation on whether cert is from known trusted CA
        var connOptions = {
            serverNode: 'localhxe:39015',
            UID: 'TESTUSER',
            PWD: 'Password1',
            proxyHostname: connProxyHost,
            proxyPort: connProxyPort,
            proxyUserName: connJwtToken,
            sslValidateCertificate: 'false'
        };
        try {
            var connection = hana.createConnection();
            connection.connect(connOptions);
            var sql = 'select TITLE, FIRSTNAME, NAME from TESTDATA.CUSTOMER;';
            var result = connection.exec(sql);
            connection.disconnect();
            resolve(result)
        } catch (error) {
            reject(error);
        }
    })
}   


// HTTP _onCallOnPrem
const _callOnPremHttp = async function(connProxyHost, connProxyPort, connJwtToken){
    return new Promise((resolve, reject) => {
        const targetUrl = 'http://localprxy:4000/' 
        const config = {
            headers: {
                'Proxy-Authorization': 'Bearer ' + connJwtToken
            },
            proxy: {
				host: connProxyHost,
				port: connProxyPort
            }
        }
		axios.get(targetUrl, config)
        .then(response => {
           resolve(response.data)
        })
        .catch(error => {
	      reject(error)
        })
	})    
}
