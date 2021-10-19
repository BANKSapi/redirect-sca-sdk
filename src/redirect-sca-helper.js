const initState = function (baseUrl) {
    const urlParams = new URLSearchParams(window.location.search);

    const callbackUrl = urlParams.get('callbackUrl');
    const forwardUrl = urlParams.get('forwardUrl');
    const session = urlParams.get('session');
    const consent = urlParams.get('consent');

    const sessionStorageFilled = sessionStorage.getItem('sca:callbackUrl') &&
        sessionStorage.getItem('sca:userToken') &&
        sessionStorage.getItem('sca:consent') &&
        sessionStorage.getItem('sca:correlationId');

    return new Promise((resolve, reject) => {
        if (!baseUrl) {
            reject(new Error('missing base url'));
        } else if (!sessionStorageFilled) {
            if (!callbackUrl) {
                reject(new Error('missing callbackUrl parameter'));
            } else if (!forwardUrl) {
                reject(new Error('missing forwardUrl parameter'));
            } else if (!session) {
                reject(new Error('missing session parameter'));
            } else if (!consent) {
                reject(new Error('missing consent parameter'));
            }
        }
        resolve({
            callbackUrl: callbackUrl,
            forwardUrl: forwardUrl,
            session: session,
            consent: consent,
            sessionStorageFilled: sessionStorageFilled,
        });
    })
}

function continueToProvider(baseUrl, state) {
    if (!state || 
        !state.session || 
        !state.callbackUrl ||
        !state.consent) {
        return Promise.reject(new Error('state not initialized'));
    }

    // get_session -> confirm_redirect -> redirect to provider
    window.fetch(`${baseUrl}/redirect-sca/sessions/${state.session}`)
        .then(response => response.json())
        .then(response => {
            const userToken = response.userToken;
            const account = response.accountId;
            const transfer = response.transferId;
            const correlationId = response.correlationId;

            if (!userToken) {
                return Promise.reject(new Error('could not determine userToken'));
            }

            if (!account && !transfer) {
                return Promise.reject(new Error('could not determine account or transfer'));
            }

            if (account) {
                sessionStorage.setItem('sca:account', account);
            }
            if (transfer) {
                sessionStorage.setItem('sca:transfer', transfer);
            }
            sessionStorage.setItem('sca:callbackUrl', state.callbackUrl);
            sessionStorage.setItem('sca:userToken', userToken);
            sessionStorage.setItem('sca:consent', state.consent);
            sessionStorage.setItem('sca:correlationId', correlationId);

            let isTransfer = !!(!account && transfer);
            confirmRedirect(baseUrl, userToken, isTransfer, state.consent, correlationId)
                .then(() => {
                    window.location.replace(state.forwardUrl);
                });
        });
}

function continueToCustomer(baseUrl) {
    let callbackUrl = sessionStorage.getItem('sca:callbackUrl');
    let userToken = sessionStorage.getItem('sca:userToken');
    let account = sessionStorage.getItem('sca:account');
    let transfer = sessionStorage.getItem('sca:transfer');
    let consent = sessionStorage.getItem('sca:consent');
    let correlationId = sessionStorage.getItem('sca:correlationId');

    let isTransfer = !!(!account && transfer);
    authenticate(baseUrl, userToken, isTransfer, consent, correlationId)
        .then(() => {
            sessionStorage.clear();
            window.location.replace(callbackUrl);
        });
}

function confirmRedirect(baseUrl, userToken, isTransfer, consent, correlationId) {
    if (isTransfer) {
        url = `${baseUrl}/redirect-sca/ueberweisung/${consent}/consent/redirect`;
    } else {
        let account = sessionStorage.getItem('sca:account');
        url = `${baseUrl}/redirect-sca/bankzugaenge/${account}/consent/${consent}/redirect`;
    }
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
            'x-correlation-id': correlationId
        },
        body: null,
    });
}

function authenticate(baseUrl, userToken, isTransfer, consent, correlationId) {
    let payload = window.location.search;

    if (isTransfer) {
        url = `${baseUrl}/redirect-sca/ueberweisung/${consent}/consent`;
    } else {
        let account = sessionStorage.getItem('sca:account');
        url = `${baseUrl}/redirect-sca/bankzugaenge/${account}/consent/${consent}`;
    }

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
            'x-correlation-id': correlationId
        },
        body: payload ?
            JSON.stringify({
                'scaAuthenticationData': payload
            }) : JSON.stringify({}),
    });
}

module.exports = {
    initState,
    continueToProvider,
    continueToCustomer,
    confirmRedirect,
    authenticate
}