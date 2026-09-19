<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
date_default_timezone_set('Europe/Berlin');
function coordinate($parts, $ref) {
    if (!is_array($parts) || count($parts) !== 3) return null;
    $values = [];
    foreach ($parts as $part) { $r = explode('/', (string)$part); if (count($r)>1 && (float)$r[1] == 0) return null; $values[] = count($r)>1 ? (float)$r[0]/(float)$r[1] : (float)$r[0]; }
    return round(($values[0]+$values[1]/60+$values[2]/3600) * (in_array($ref,['S','W'],true)?-1:1), 6);
}
$photos=[];$folder=dirname(__DIR__).'/gallery-ATTENTION-autoupload';
foreach (new DirectoryIterator($folder) as $file) {
 if (!$file->isFile() || $file->isLink() || !in_array(strtolower($file->getExtension()), ['jpg','jpeg','png','webp','gif'],true)) continue;
 $path=$file->getPathname();$size=@getimagesize($path);if (!$size) continue;
 $exif=function_exists('exif_read_data') && in_array(strtolower($file->getExtension()),['jpg','jpeg'],true) ? (@exif_read_data($path,'EXIF,GPS',true) ?: []) : [];
 $raw=$exif['EXIF']['DateTimeOriginal']??$exif['IFD0']['DateTime']??null;
 $date=$raw ? DateTimeImmutable::createFromFormat('!Y:m:d H:i:s',$raw) : false;
 $timestamp=$date ? $date->getTimestamp() : $file->getMTime();
 $gps=$exif['GPS']??[];$lat=coordinate($gps['GPSLatitude']??null,$gps['GPSLatitudeRef']??'');$lon=coordinate($gps['GPSLongitude']??null,$gps['GPSLongitudeRef']??'');
 $photos[]=['src'=>'/gallery-ATTENTION-autoupload/'.rawurlencode($file->getFilename()),'title'=>pathinfo($file->getFilename(),PATHINFO_FILENAME),'timestamp'=>$timestamp,'date'=>date(DATE_ATOM,$timestamp),'date_source'=>$date?'capture':'file','latitude'=>$lat,'longitude'=>$lon,'width'=>$size[0],'height'=>$size[1]];
}
usort($photos,fn($a,$b)=>($b['timestamp']<=>$a['timestamp'])?:strcmp($a['src'],$b['src']));
echo json_encode($photos,JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE);
