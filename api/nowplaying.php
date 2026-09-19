<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$config = require __DIR__ . '/config.php';
$url = rtrim($config['azuracast_url'], '/') . '/api/nowplaying/' . rawurlencode($config['station']);
$ch = curl_init($url);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 2, CURLOPT_TIMEOUT => 5]);
$body = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
$data = is_string($body) ? json_decode($body, true) : null;
if ($code !== 200 || !is_array($data) || !isset($data['station'])) { http_response_code(503); echo json_encode(['error'=>'Station unavailable']); exit; }
echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
