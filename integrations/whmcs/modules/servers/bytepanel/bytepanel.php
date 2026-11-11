<?php

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

function bytepanel_MetaData()
{
    return [
        'DisplayName' => 'BytePanel',
        'APIVersion' => '1.1',
        'RequiresServer' => true,
        'DefaultNonSSLPort' => '80',
        'DefaultSSLPort' => '443',
        'ServiceSingleSignOnLabel' => 'Open control panel',
    ];
}

function bytepanel_ConfigOptions()
{
    return [
        'Plan' => [
            'Type' => 'text',
            'Size' => '40',
            'Loader' => 'bytepanel_PlanLoader',
            'SimpleMode' => true,
            'Description' => 'The BytePanel plan that sets this product\'s resources.',
        ],
        'Game' => [
            'Type' => 'text',
            'Size' => '40',
            'Loader' => 'bytepanel_GameLoader',
            'SimpleMode' => true,
            'Description' => 'Customers can choose instead with a configurable option named Game.',
        ],
        'Location' => [
            'Type' => 'text',
            'Size' => '40',
            'Loader' => 'bytepanel_LocationLoader',
            'SimpleMode' => true,
            'Description' => 'Leave empty for any location. Customers can choose with a configurable option named Location.',
        ],
    ];
}

function bytepanel_PlanLoader(array $params)
{
    return bytepanel_CatalogOptions($params, 'plans', 'name', false);
}

function bytepanel_GameLoader(array $params)
{
    return bytepanel_CatalogOptions($params, 'eggs', 'name', true);
}

function bytepanel_LocationLoader(array $params)
{
    return bytepanel_CatalogOptions($params, 'locations', 'long', true);
}

function bytepanel_TestConnection(array $params)
{
    try {
        bytepanel_Request($params, 'GET', '/catalog');
    } catch (Throwable $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }

    return ['success' => true, 'error' => ''];
}

function bytepanel_CreateAccount(array $params)
{
    try {
        $egg = bytepanel_Choice($params, 'Game', 'configoption2');
        if ($egg === '') {
            return 'No game was selected for this service';
        }
        $client = $params['clientsdetails'] ?? [];
        $email = (string) ($client['email'] ?? '');
        $name = trim(($client['firstname'] ?? '') . ' ' . ($client['lastname'] ?? ''));
        $payload = [
            'eggId' => $egg,
            'environment' => bytepanel_Environment($params),
            'externalId' => bytepanel_ExternalId($params),
            'planId' => trim((string) ($params['configoption1'] ?? '')),
            'user' => [
                'email' => $email,
                'name' => mb_substr($name !== '' ? $name : $email, 0, 100),
            ],
        ];
        $location = bytepanel_Choice($params, 'Location', 'configoption3');
        if ($location !== '') {
            $payload['locationId'] = $location;
        }
        $serverName = trim((string) ($params['customfields']['Server Name'] ?? ''));
        if (mb_strlen($serverName) >= 3) {
            $payload['name'] = mb_substr($serverName, 0, 40);
        }
        bytepanel_Request($params, 'POST', '/servers', $payload);
    } catch (Throwable $e) {
        return $e->getMessage();
    }

    return 'success';
}

function bytepanel_SuspendAccount(array $params)
{
    return bytepanel_Action($params, 'POST', '/suspend');
}

function bytepanel_UnsuspendAccount(array $params)
{
    return bytepanel_Action($params, 'DELETE', '/suspend');
}

function bytepanel_TerminateAccount(array $params)
{
    return bytepanel_Action($params, 'DELETE', '');
}

function bytepanel_ChangePackage(array $params)
{
    return bytepanel_Action($params, 'PATCH', '', ['planId' => trim((string) ($params['configoption1'] ?? ''))]);
}

function bytepanel_ServiceSingleSignOn(array $params)
{
    try {
        $out = bytepanel_Request($params, 'POST', bytepanel_ServerPath($params) . '/login');
        if (empty($out['url'])) {
            throw new RuntimeException('BytePanel did not return a login link');
        }
    } catch (Throwable $e) {
        return ['success' => false, 'errorMsg' => $e->getMessage()];
    }

    return ['success' => true, 'redirectTo' => $out['url']];
}

function bytepanel_AdminServicesTabFields(array $params)
{
    try {
        $server = bytepanel_Request($params, 'GET', bytepanel_ServerPath($params))['server'] ?? [];
    } catch (Throwable $e) {
        return ['BytePanel' => htmlspecialchars($e->getMessage())];
    }
    $status = htmlspecialchars((string) ($server['status'] ?? 'unknown'));
    $url = htmlspecialchars((string) ($server['url'] ?? ''));

    return [
        'BytePanel server' => '<a href="' . $url . '" target="_blank" rel="noopener">' . htmlspecialchars((string) ($server['name'] ?? $url)) . '</a>',
        'BytePanel status' => $status,
    ];
}

function bytepanel_Action(array $params, string $method, string $suffix, ?array $body = null)
{
    try {
        bytepanel_Request($params, $method, bytepanel_ServerPath($params) . $suffix, $body);
    } catch (Throwable $e) {
        return $e->getMessage();
    }

    return 'success';
}

function bytepanel_ExternalId(array $params)
{
    return 'whmcs-' . (int) $params['serviceid'];
}

function bytepanel_ServerPath(array $params)
{
    return '/servers/' . rawurlencode(bytepanel_ExternalId($params));
}

function bytepanel_Choice(array $params, string $option, string $fallback)
{
    $chosen = trim((string) ($params['configoptions'][$option] ?? ''));

    return $chosen !== '' ? $chosen : trim((string) ($params[$fallback] ?? ''));
}

function bytepanel_Environment(array $params)
{
    $environment = [];
    foreach (array_merge($params['customfields'] ?? [], $params['configoptions'] ?? []) as $key => $value) {
        if (is_string($key) && preg_match('/^[A-Z][A-Z0-9_]*$/', $key) && is_scalar($value)) {
            $environment[$key] = (string) $value;
        }
    }

    return (object) $environment;
}

function bytepanel_CatalogOptions(array $params, string $key, string $label, bool $optional)
{
    $options = $optional ? ['' => 'None'] : [];
    foreach (bytepanel_Request($params, 'GET', '/catalog')[$key] ?? [] as $item) {
        if (!empty($item['id'])) {
            $options[(string) $item['id']] = (string) ($item[$label] ?? $item['id']);
        }
    }

    return $options;
}

function bytepanel_BaseUrl(array $params)
{
    $host = trim((string) ($params['serverhostname'] ?? ''));
    if ($host === '') {
        $host = trim((string) ($params['serverip'] ?? ''));
    }
    if ($host === '') {
        throw new RuntimeException('Set the panel hostname on the WHMCS server');
    }
    if (!preg_match('#^https?://#i', $host)) {
        $secure = $params['serversecure'] ?? true;
        $scheme = ($secure && $secure !== 'off') ? 'https' : 'http';
        $port = (string) ($params['serverport'] ?? '');
        $host = $scheme . '://' . $host;
        if ($port !== '' && !in_array($port, ['80', '443'], true) && !preg_match('#:\d+$#', $host)) {
            $host .= ':' . $port;
        }
    }

    return preg_replace('#/api/application$#', '', rtrim($host, '/'));
}

function bytepanel_Request(array $params, string $method, string $path, ?array $body = null)
{
    $key = trim((string) ($params['serveraccesshash'] ?? ''));
    if ($key === '') {
        $key = trim((string) ($params['serverpassword'] ?? ''));
    }
    if ($key === '') {
        throw new RuntimeException('Set the BytePanel API key on the WHMCS server');
    }
    $url = bytepanel_BaseUrl($params) . '/api/application' . $path;
    $headers = ['Accept: application/json', 'Authorization: Bearer ' . $key];
    $encoded = $body === null ? null : json_encode($body, JSON_UNESCAPED_SLASHES);
    if ($encoded !== null) {
        $headers[] = 'Content-Type: application/json';
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 60,
    ]);
    if ($encoded !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $encoded);
    }
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    $decoded = is_string($raw) ? json_decode($raw, true) : null;
    logModuleCall('bytepanel', $method . ' ' . $path, $encoded, $raw, $decoded, [$key]);

    if ($raw === false) {
        throw new RuntimeException('Could not reach BytePanel: ' . $error);
    }
    if ($status < 200 || $status >= 300) {
        $message = is_array($decoded) && is_string($decoded['error'] ?? null) ? $decoded['error'] : 'request failed';
        throw new RuntimeException('BytePanel: ' . $message . ' (HTTP ' . $status . ')');
    }

    return is_array($decoded) ? $decoded : [];
}
