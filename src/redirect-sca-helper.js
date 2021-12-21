const QUERY_PARAM_REDIRECT_SCA_ERROR = 'redirect-sca-error';

const initState = function (baseUrl) {
    const urlParams = new URLSearchParams(window.location.search);

    const callbackUrl = urlParams.get('callbackUrl');
    const forwardUrl = urlParams.get('forwardUrl');
    const session = urlParams.get('session');
    const consent = urlParams.get('consent');

    const queryParamsFilled = callbackUrl && forwardUrl && session && consent;
    if (queryParamsFilled) {
        sessionStorage.clear();
    }

    if (isSessionStorageFilled()) {
        clearStateIfTooOld();
    }

    const sessionStorageFilled = isSessionStorageFilled();
    return new Promise((resolve, reject) => {
        if (!baseUrl) {
            reject(new Error('missing base url'));
        } else if (!sessionStorageFilled && !queryParamsFilled) {
            reject(new Error('state could not be initialized'))
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
    return fetch(`${baseUrl}/redirect-sca/sessions/${state.session}`)
        .then(response => {
            if (response.status >= 400) {
                throw new Error(`HTTP ${response.status} can not be handled`);
            }
            return Promise.resolve(response);
        })
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
            sessionStorage.setItem('sca:time', new Date().toISOString());

            let isTransfer = !!(!account && transfer);
            return confirmRedirect(baseUrl, userToken, isTransfer, state.consent, correlationId)
                .then(() => {
                    window.location.replace(state.forwardUrl);
                    return state.forwardUrl;
                });
        });
}

function continueToCustomer(baseUrl, redirectFn = defaultRedirectToCustomerFn) {
    let callbackUrl = sessionStorage.getItem('sca:callbackUrl');
    let userToken = sessionStorage.getItem('sca:userToken');
    let account = sessionStorage.getItem('sca:account');
    let transfer = sessionStorage.getItem('sca:transfer');
    let consent = sessionStorage.getItem('sca:consent');
    let correlationId = sessionStorage.getItem('sca:correlationId');
    
    let redirectScaError = evaluateUrlForErrors(window.location.href);
    let isTransfer = !!(!account && transfer);

    return authenticate(baseUrl, userToken, isTransfer, consent, correlationId)
        .then(() => {
            sessionStorage.clear();
            return redirectFn(callbackUrl, { redirectScaError });
        });
}

function defaultRedirectToCustomerFn(callbackUrl, { redirectScaError }) {
    if (redirectScaError) {
        let url = new URL(callbackUrl);
        url.searchParams.set(QUERY_PARAM_REDIRECT_SCA_ERROR, redirectScaError);
        callbackUrl = url.toString();
    }

    window.location.replace(callbackUrl);
    return callbackUrl;
}

function confirmRedirect(baseUrl, userToken, isTransfer, consent, correlationId) {
    let url;
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
    }).then(response => {
        if (response.status >= 400) {
            throw new Error(`HTTP ${response.status} can not be handled`);
        }
        return Promise.resolve(response);
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
    }).then(response => {
        if (response.status >= 400) {
            throw new Error(`HTTP ${response.status} can not be handled`);
        }
        return Promise.resolve(response);
    });
}

function abortSca() {
    if (isSessionStorageFilled()) {
        let callbackUrl = sessionStorage.getItem('sca:callbackUrl');
        let userToken = sessionStorage.getItem('sca:userToken');
        let account = sessionStorage.getItem('sca:account');
        let transfer = sessionStorage.getItem('sca:transfer');
        let consent = sessionStorage.getItem('sca:consent');
        let correlationId = sessionStorage.getItem('sca:correlationId');

        let isTransfer = !!(!account && transfer);
        authenticate(baseUrl, userToken, isTransfer, consent, correlationId)
            .finally(() => {
                sessionStorage.clear();
                let url = new URL(callbackUrl);
                url.searchParams.set(QUERY_PARAM_REDIRECT_SCA_ERROR, 'user abort');
                window.location.replace(url);
            });
    } else {
        return Promise.reject(new Error('callback not found'));
    }
}

function isSessionStorageFilled() {
    return !!(sessionStorage.getItem('sca:callbackUrl') &&
        sessionStorage.getItem('sca:userToken') &&
        sessionStorage.getItem('sca:consent') &&
        sessionStorage.getItem('sca:correlationId') &&
        sessionStorage.getItem('sca:time') &&
        (sessionStorage.getItem('sca:account') || sessionStorage.getItem('sca:transfer')));
}

function evaluateUrlForErrors(urlString) {
    let url = new URL(urlString);
    let errorValue;
    if (url.searchParams.has('error_uri')) {
        errorValue = 'Fehler bei Kundenauthentifizierung';
    } else if (url.searchParams.has('error')) {
        errorValue = url.searchParams.get('error');
    } else if (url.searchParams.has('error_description')) {
        errorValue = url.searchParams.get('error_description');
    }
    return errorValue;
}

function clearStateIfTooOld() {
    let startTime = new Date(sessionStorage.getItem('sca:time'));
    let endTime = new Date();
    let difference = Math.abs(endTime.getTime() - startTime.getTime());
    let minutes = Math.round(difference / 60000);
    if (minutes > 15) {
        sessionStorage.clear();
    }
}

module.exports = {
    initState,
    continueToProvider,
    continueToCustomer,
    confirmRedirect,
    authenticate,
    abortSca
};