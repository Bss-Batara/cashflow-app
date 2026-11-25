/**
 * Cashflow JSON API router.
 *
 * Deployment must use execute-as-user-accessing and signed-in users only.
 * Every action is authorization-gated before reaching the CRUD layer.
 */
function doGet(event) {
  const response = handleApiRequest_({
    method: 'GET',
    parameters: event && event.parameter ? event.parameter : {}
  });
  const callback = event && event.parameter && event.parameter.callback;
  return callback ? apiJsonpResponse_(response, callback) : response;
}

function doPost(event) {
  let body = {};
  try {
    const raw = event && event.postData && event.postData.contents;
    if (raw && /^\s*\{/.test(raw)) {
      body = JSON.parse(raw);
    } else {
      const parameters = event && event.parameter ? event.parameter : {};
      body = parameters.payload ? JSON.parse(parameters.payload) : parameters;
    }
  } catch (error) {
    return apiErrorResponse_('Request body must be valid JSON.', 'INVALID_JSON');
  }

  return handleApiRequest_({
    method: 'POST',
    body: body,
    parameters: event && event.parameter ? event.parameter : {}
  });
}

function handleApiRequest_(request) {
  const requestId = Utilities.getUuid();

  try {
    const action = getApiAction_(request);

    // Aksi publik tidak butuh identitas; aksi lain memakai token login
    // (username/password) atau akun Google yang ada di allowlist.
    if (['health', 'login'].indexOf(action) === -1) {
      CASHFLOW_REQUEST_IDENTITY = resolveApiIdentity_(request);
    }

    const result = dispatchApiAction_(action, request);

    return apiJsonResponse_({
      ok: true,
      requestId: requestId,
      data: result
    });
  } catch (error) {
    Logger.log(JSON.stringify({
      requestId: requestId,
      error: error.message
    }));
    return apiJsonResponse_({
      ok: false,
      requestId: requestId,
      error: {
        code: classifyApiError_(error),
        message: error.message || 'Request failed.'
      }
    });
  }
}

function getApiAction_(request) {
  const source = request.method === 'GET'
    ? request.parameters
    : request.body;
  const action = String(source && source.action || '').trim();

  if (!action) {
    throw new Error('action is required.');
  }

  return action;
}

function dispatchApiAction_(action, request) {
  const source = request.method === 'GET'
    ? request.parameters
    : request.body;
  const payload = request.method === 'POST'
    ? (source.payload || source.data || source)
    : source;

  switch (action) {
    case 'health':
      return {
        service: 'cashflow-api',
        schemaVersion: getCashflowConfig_().schemaVersion,
        authenticated: Boolean(CASHFLOW_REQUEST_IDENTITY)
      };
    // Pendaftaran publik ditutup. Akun dibuat manual oleh administrator.
    // case 'register': return registerUser(payload);
    case 'login':
      // GET diizinkan: frontend memakai JSONP.
      return loginUser(payload);
    case 'logout':
      requirePost_(request);
      return logoutUser(payload.token || source.token);
    case 'me':
      return currentUser(payload.token || source.token);
    case 'listTransactions':
      return listTransactions({
        includeVoided: toBoolean_(payload.includeVoided)
      });
    case 'createTransaction':
      requirePost_(request);
      return createTransaction(payload);
    case 'updateTransaction':
      requirePost_(request);
      return updateTransaction(payload);
    case 'voidTransaction':
      requirePost_(request);
      return voidTransaction(payload.transactionId, payload.expectedVersion);
    case 'listCategories':
      return listCategories(payload.categoryType || '');
    case 'createCategory':
      requirePost_(request);
      return createCategory(payload);
    case 'updateCategory':
      requirePost_(request);
      return updateCategory(payload);
    case 'deactivateCategory':
      requirePost_(request);
      return deactivateCategory(payload.categoryId);
    case 'verifySchema':
      return verifyCashflowSchema();
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}

function requirePost_(request) {
  if (request.method !== 'POST') {
    throw new Error('This action requires POST.');
  }
}

function toBoolean_(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

function classifyApiError_(error) {
  const message = String(error && error.message || '');
  if (/allowlist|allowlisted|access denied|authenticated/i.test(message)) {
    return 'AUTHORIZATION_FAILED';
  }
  if (/required|must be|invalid|format|type|characters|integer/i.test(message)) {
    return 'VALIDATION_FAILED';
  }
  if (/not found/i.test(message)) {
    return 'NOT_FOUND';
  }
  if (/conflict/i.test(message)) {
    return 'VERSION_CONFLICT';
  }
  return 'REQUEST_FAILED';
}

function apiJsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function apiJsonpResponse_(response, callback) {
  const name = String(callback || '').trim();
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(name)) {
    return apiJsonResponse_({
      ok: false,
      requestId: Utilities.getUuid(),
      error: { code: 'INVALID_CALLBACK', message: 'Invalid callback name.' }
    });
  }

  return ContentService
    .createTextOutput(`${name}(${response.getContent()});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function apiErrorResponse_(message, code) {
  return apiJsonResponse_({
    ok: false,
    requestId: Utilities.getUuid(),
    error: { code: code, message: message }
  });
}

/** Manual API smoke test without deploying a web app. */
function verifyApiHealth() {
  const response = handleApiRequest_({
    method: 'GET',
    parameters: { action: 'health' }
  });
  Logger.log(response.getContent());
  return response.getContent();
}
// Extend the router with investment actions without relying on Apps Script file order.
(() => {
  const originalDispatch = dispatchApiAction_;
  dispatchApiAction_ = function (action, request) {
    const source = request.method === 'GET' ? request.parameters : request.body;
    const payload = request.method === 'POST' ? (source.payload || source.data || source) : source;
    switch (action) {
      case 'listInvestments': return listInvestments({ includeVoided: toBoolean_(payload.includeVoided) });
      case 'createInvestment': requirePost_(request); return createInvestment(payload);
      case 'updateInvestment': requirePost_(request); return updateInvestment(payload);
      case 'voidInvestment': requirePost_(request); return voidInvestment(payload.investmentId, payload.expectedVersion);
      default: return originalDispatch(action, request);
    }
  };
})();
