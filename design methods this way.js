design methods this way


testBrokerConnection(creds){
    // if auth token exists and not exipred
    if (creds.authToken && creds.authtoken not expired){
        return {
            ...creds,
            activated: true
        }
    } 
    // if refresh Token exists
    else if(creds.refreshtoken){

        // if refresh token not expired
        if(creds.refreshtoken not expired){
            const newauthtoken = refresh(creds.refreshtoken)
            return {
                ...creds,
                authtoken: newauthtoken,
                activated: true
            }
        } 
        
        // if refresh token expired and auth url exists
        else if(creds.authUrl){
            return {
                ...creds,
                activated: false,
                authFlowRequired: true,
            }
        } 
        
        // if refresh token expired and auth url does not exists
        else if (!creds.authUrl){
            return {
                ...creds,
                activated: false,
                authFlowRequired: true,
                authUrl: generateAuthUrl(creds)
            }
        }
    } 
    
    // if auth code exists
    else if(creds.authCode){
        const { authCode, ...restCreds } = creds; // we dont wnat to save authcode as it is a single time use
        return {
            ...creds,
            activated: true,
            authtoken: generateAuthToken(authCode),
            refreshToken: generateRefreshToken(authCode)
        }
    }

    // this will be mostly shoonya way of authentication
    else {
        const testBrokerCnnection = test(creds);
        return {
            ...testBrokerCnnection,
            activated: testBrokerCnnection.success,
            authFlowRequired: !testBrokerCnnection.success && testBrokerCnnection.authUrl ? true : false
        };
    }

    // what ever is returned from this method should be saves as creds in debugger. for later use of activation

}






