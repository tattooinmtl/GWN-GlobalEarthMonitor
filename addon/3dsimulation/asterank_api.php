<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$routes = [
    'asterank' => 'https://asterank.com/api/asterank',
    'mpc' => 'https://asterank.com/api/mpc',
    'kepler' => 'https://asterank.com/api/kepler',
    'skymorph_search' => 'https://asterank.com/api/skymorph/search',
    'skymorph_search_orbit' => 'https://asterank.com/api/skymorph/search_orbit',
    'skymorph_search_position' => 'https://asterank.com/api/skymorph/search_position',
    'skymorph_image' => 'https://asterank.com/api/skymorph/image',
];

$endpoint = $_GET['endpoint'] ?? 'asterank';

if (!isset($routes[$endpoint])) {
    header('Content-Type: application/json');
    http_response_code(400);
    echo json_encode(['error' => 'Unsupported Asterank endpoint']);
    exit;
}

$params = $_GET;
unset($params['endpoint']);

// Allowlist query parameters to prevent SSRF parameter injection
$allowedParams = ['query', 'limit', 'offset', 'sort', 'fields', 'ra', 'dec', 'target', 'epoch'];
$params = array_intersect_key($params, array_flip($allowedParams));

$queryString = http_build_query($params);
$url = $routes[$endpoint] . ($queryString !== '' ? '?' . $queryString : '');

if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 25);
    curl_setopt($ch, CURLOPT_USERAGENT, 'GlobalWarningNetworks-3DSimulation/1.0');

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $error = curl_error($ch);
    curl_close($ch);
} else {
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "User-Agent: GlobalWarningNetworks-3DSimulation/1.0\r\n",
            'timeout' => 25,
            'ignore_errors' => true,
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ],
    ]);

    $response = @file_get_contents($url, false, $context);
    $httpCode = 200;
    $contentType = 'application/json';
    $error = $response === false ? 'Unable to fetch endpoint with stream fallback.' : '';

    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $headerLine) {
            if (preg_match('#HTTP/\S+\s+(\d{3})#', $headerLine, $matches)) {
                $httpCode = (int) $matches[1];
            }
            if (stripos($headerLine, 'Content-Type:') === 0) {
                $contentType = trim(substr($headerLine, 13));
            }
        }
    }
}

if ($response === false) {
    header('Content-Type: application/json');
    http_response_code(502);
    echo json_encode([
        'error' => 'Failed to fetch Asterank endpoint',
        'details' => $error,
        'url' => $url,
    ]);
    exit;
}

header('Content-Type: ' . ($contentType ?: 'application/json'));
http_response_code($httpCode > 0 ? $httpCode : 200);
echo $response;