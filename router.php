<?php
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH));
if (preg_match('~^/(azuracast|tests)(/|$)|/\.|^/(README|router\.php)~i',$path) || str_contains($path,'..')) {http_response_code(404);exit;}
if (str_starts_with($path,'/gallery-ATTENTION-autoupload/') && !preg_match('/\.(jpg|jpeg|png|webp|gif)$/i',$path)){http_response_code(404);exit;}
return false;
