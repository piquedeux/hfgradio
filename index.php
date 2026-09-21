<?php
// Single request entry point; serve only public asset files directly in the development server.
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)??'/');
if(str_contains($path,'..')||preg_match('~/(?:\.|snippets(?:/|$))~',$path)){http_response_code(404);exit;}
if(preg_match('~^/(assets|material)/~',$path)){
 if(preg_match('/\.(php|phtml|phar|htaccess)$/i',$path)){http_response_code(404);exit;}
 if(is_file(__DIR__.$path)&&PHP_SAPI==='cli-server')return false;
 http_response_code(404);exit;
}

function content_values(){
 $file=__DIR__.'/content.txt';$values=[];
 if(!is_file($file))return $values;
 foreach(file($file,FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES) as $line){$line=trim($line);if($line===''||$line[0]==='#')continue;$separator=strpos($line,'=');if($separator===false)continue;$key=trim(substr($line,0,$separator));$value=trim(substr($line,$separator+1));if($key!=='')$values[$key]=str_replace('\\n',"\n",$value);}
 return $values;
}
$content=content_values();
function content_text($key,$fallback=''){global $content;return htmlspecialchars($content[$key]??$fallback,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function content_value($key,$fallback=''){global $content;return $content[$key]??$fallback;}
function content_url($key,$fallback=''){return htmlspecialchars(content_value($key,$fallback),ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function content_lines($key,$fallback=''){return nl2br(content_text($key,$fallback),false);}

// Public folder adapter. No account credentials; keep last good listing if Google is unavailable.
function drive_cache_dir(){ $dir=sys_get_temp_dir().'/hfg-drive-'.hash('sha256',__DIR__);if(!is_dir($dir))mkdir($dir,0700,true);return $dir; }
function drive_listing(){
 $cache=drive_cache_dir().'/listing.json';
 if(is_file($cache)&&time()-filemtime($cache)<300)return json_decode(file_get_contents($cache),true)?:[];
 $ch=curl_init('https://drive.google.com/embeddedfolderview?id=1QO0CYPm5Px3qDIRHCsnimjfNS9DnGYLG');curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>8]);$body=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
 if($code!==200||!is_string($body)||!str_contains($body,'flip-entries'))return is_file($cache)?json_decode(file_get_contents($cache),true):[];
 $dom=new DOMDocument();@$dom->loadHTML($body,LIBXML_NONET);$xp=new DOMXPath($dom);$rows=[];
 foreach($xp->query('//div[contains(concat(" ",normalize-space(@class)," ")," flip-entry ")]') as $entry){
  $id=substr($entry->getAttribute('id'),6);$name=trim($xp->evaluate('string(.//div[@class="flip-entry-title"])',$entry));
  if(!preg_match('/^[A-Za-z0-9_-]{15,100}$/',$id)||!preg_match('/\.(jpe?g|png|gif|webp)$/i',$name))continue;
  $rows[]=['id'=>$id,'name'=>$name];
 }
 file_put_contents($cache,json_encode($rows),LOCK_EX);return $rows;
}
function drive_original($id){
 $file=drive_cache_dir().'/'.$id.'.image';if(is_file($file)&&time()-filemtime($file)<3600)return $file;
 $temp=tempnam(drive_cache_dir(),'download-');$handle=fopen($temp,'wb');$bytes=0;
 $ch=curl_init('https://drive.usercontent.google.com/download?id='.rawurlencode($id).'&export=download');curl_setopt_array($ch,[CURLOPT_FOLLOWLOCATION=>true,CURLOPT_MAXREDIRS=>3,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>12,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_REDIR_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_WRITEFUNCTION=>function($ch,$chunk)use($handle,&$bytes){$bytes+=strlen($chunk);if($bytes>25*1024*1024)return 0;return fwrite($handle,$chunk);}]);$ok=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);fclose($handle);
 $info=@getimagesize($temp);if($ok&&$code===200&&$info&&in_array($info['mime'],['image/jpeg','image/png','image/gif','image/webp'])){rename($temp,$file);return $file;}unlink($temp);return is_file($file)?$file:null;
}
function drive_photos(){
 $photos=[];$downloads=0;foreach(drive_listing() as $row){$path=drive_cache_dir().'/'.$row['id'].'.image';if(!is_file($path)||time()-filemtime($path)>3600){if($downloads++<4){$path=drive_original($row['id']);}elseif(!is_file($path)){continue;}}if(!$path)continue;$size=@getimagesize($path);if(!$size)continue;
 $exif=$size['mime']==='image/jpeg'&&function_exists('exif_read_data')?(@exif_read_data($path,'EXIF,GPS',true)?:[]):[];
 $raw=$exif['EXIF']['DateTimeOriginal']??$exif['IFD0']['DateTime']??null;$date=$raw?DateTimeImmutable::createFromFormat('!Y:m:d H:i:s',$raw):false;$timestamp=$date?$date->getTimestamp():null;
 $gps=$exif['GPS']??[];
 $photos[]=['src'=>'/index.php?api=drive-image&id='.$row['id'],'title'=>pathinfo($row['name'],PATHINFO_FILENAME),'timestamp'=>$timestamp,'date'=>$timestamp?date(DATE_ATOM,$timestamp):null,'date_source'=>$date?'capture':'unknown','latitude'=>coordinate($gps['GPSLatitude']??null,$gps['GPSLatitudeRef']??''),'longitude'=>coordinate($gps['GPSLongitude']??null,$gps['GPSLongitudeRef']??''),'width'=>$size[0],'height'=>$size[1]];
 }return $photos;
}

$api=$_GET['api']??null;
if(preg_match('~^/api/([a-z-]+)\.php$~',$path,$m))$api=$m[1];
if($api!==null){switch($api){
case 'archive':

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$cache = sys_get_temp_dir() . '/hfgradio-archive-v4-' . hash('sha256', __DIR__) . '.json';
if (is_file($cache) && time()-filemtime($cache)<300) {readfile($cache);exit;}
$base='https://feeds.soundcloud.com/users/soundcloud:users:1478398819/sounds.rss';
$url=$base;$posts=[];$seen=[];
try {
 for($page=0;$url && $page<100;$page++) {
  if(isset($seen[$url])) throw new RuntimeException('Repeated feed page');$seen[$url]=true;
  $ch=curl_init($url);curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>8]);
  $body=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
  if($status!==200 || !is_string($body))throw new RuntimeException('Feed unavailable');
  libxml_use_internal_errors(true);$xml=simplexml_load_string($body,'SimpleXMLElement',LIBXML_NONET);
  if(!$xml || !isset($xml->channel))throw new RuntimeException('Invalid feed');
  foreach($xml->channel->item as $item){
   $link=(string)$item->link;$audio=(string)$item->enclosure['url'];
   if(!preg_match('~^https://soundcloud\.com/hfg-radio/~',$link))continue;
   $host=parse_url($audio,PHP_URL_HOST)??'';
   if(parse_url($audio,PHP_URL_SCHEME)!=='https' || !preg_match('/(^|\.)soundcloud\.com$/',$host))$audio='';
   $art=(string)$item->children('http://www.itunes.com/dtds/podcast-1.0.dtd')->image->attributes()['href'];
   if(!$art)$art=(string)$xml->channel->children('http://www.itunes.com/dtds/podcast-1.0.dtd')->image->attributes()['href'];
   if(!preg_match('~^https://[^/]+\.sndcdn\.com/~',$art))$art='';
   $title=(string)$item->title;
   $artist=trim((string)$item->children('http://www.itunes.com/dtds/podcast-1.0.dtd')->author);
   if(strcasecmp($artist,'HFG RADIO')===0)$artist='';
   // Only extract explicitly credited names; do not invent artists for uncredited shows.
   if(!$artist && preg_match('/(?:\bw\/|\bwith\b|\bby\b)\s+(.+?)(?:\s*\(\d|$)/iu',$title,$match))$artist=trim($match[1]);
   if(!$artist && preg_match('/^(?:GUEST SESSION(?: \d+)?|THURSDAY SHOW|ROOM SERVICE|Arena Sitzung #\d+|Radio High Five|See Saw Zinefest|Flip Off - Rundgang \d+|RUNDGANG RADIO KICK OFF):?\s+(.+?)(?:\s*\(\d|$)/iu',$title,$match))$artist=trim($match[1]);
   $id=(string)$item->guid;$posts[$id]=['id'=>$id,'title'=>(string)$item->title,'permalink_url'=>$link,'created_at'=>date(DATE_ATOM,strtotime((string)$item->pubDate)?:0),'audio_url'=>$audio,'artwork_url'=>$art,'artist'=>$artist];
  }
  $url='';foreach($xml->channel->children('http://www.w3.org/2005/Atom')->link as $link){if((string)$link['rel']==='next'){$next=(string)$link['href'];if(str_starts_with($next,$base.'?before=') && preg_match('/\?before=\d+$/',$next))$url=$next;}}
 }
 if($url)throw new RuntimeException('Feed pagination limit');
 $posts=array_values($posts);usort($posts,fn($a,$b)=>strcmp($b['created_at'],$a['created_at']));
 $json=json_encode(['posts'=>$posts,'stale'=>false],JSON_INVALID_UTF8_SUBSTITUTE|JSON_UNESCAPED_SLASHES);
 $tmp=tempnam(sys_get_temp_dir(),'hfg-feed-');if($tmp!==false){file_put_contents($tmp,$json);rename($tmp,$cache);}echo $json;
} catch(Throwable $e){
 if(is_file($cache)){$data=json_decode(file_get_contents($cache),true);$data['stale']=true;echo json_encode($data);}else{http_response_code(502);echo json_encode(['error'=>'SoundCloud unavailable']);}
}

exit;
case 'gallery':

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
date_default_timezone_set('Europe/Berlin');
function coordinate($parts, $ref) {
    if (!is_array($parts) || count($parts) !== 3) return null;
    $values = [];
    foreach ($parts as $part) { $r = explode('/', (string)$part); if (count($r)>1 && (float)$r[1] == 0) return null; $values[] = count($r)>1 ? (float)$r[0]/(float)$r[1] : (float)$r[0]; }
    return round(($values[0]+$values[1]/60+$values[2]/3600) * (in_array($ref,['S','W'],true)?-1:1), 6);
}
$photos=[];$folder=__DIR__.'/material/gallery-ATTENTION-autoupload';
foreach (new DirectoryIterator($folder) as $file) {
 if (!$file->isFile() || $file->isLink() || !in_array(strtolower($file->getExtension()), ['jpg','jpeg','png','webp','gif'],true)) continue;
 $path=$file->getPathname();$size=@getimagesize($path);if (!$size) continue;
 $exif=function_exists('exif_read_data') && in_array(strtolower($file->getExtension()),['jpg','jpeg'],true) ? (@exif_read_data($path,'EXIF,GPS',true) ?: []) : [];
 $raw=$exif['EXIF']['DateTimeOriginal']??$exif['IFD0']['DateTime']??null;
 $date=$raw ? DateTimeImmutable::createFromFormat('!Y:m:d H:i:s',$raw) : false;
 $timestamp=$date ? $date->getTimestamp() : $file->getMTime();
 $gps=$exif['GPS']??[];$lat=coordinate($gps['GPSLatitude']??null,$gps['GPSLatitudeRef']??'');$lon=coordinate($gps['GPSLongitude']??null,$gps['GPSLongitudeRef']??'');
 $photos[]=['src'=>'/material/gallery-ATTENTION-autoupload/'.rawurlencode($file->getFilename()),'title'=>pathinfo($file->getFilename(),PATHINFO_FILENAME),'timestamp'=>$timestamp,'date'=>date(DATE_ATOM,$timestamp),'date_source'=>$date?'capture':'file','latitude'=>$lat,'longitude'=>$lon,'width'=>$size[0],'height'=>$size[1]];
}

$photos=array_merge($photos,drive_photos());
usort($photos,fn($a,$b)=>($b['timestamp']<=>$a['timestamp'])?:strcmp($a['src'],$b['src']));
echo json_encode($photos,JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE);

exit;
case 'drive-image':


$id=$_GET['id']??'';if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{15,100}$/',$id)||!in_array($id,array_column(drive_listing(),'id'),true)){http_response_code(404);exit;}
$file=drive_original($id);if(!$file){http_response_code(502);exit;}$size=getimagesize($file);header('Content-Type: '.$size['mime']);header('X-Content-Type-Options: nosniff');header('Cache-Control: public, max-age=300');readfile($file);

exit;
case 'nowplaying':

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$config = ['azuracast_url' => 'http://127.0.0.1:8080', 'station' => 'hfg_radio'];
$url = rtrim($config['azuracast_url'], '/') . '/api/nowplaying/' . rawurlencode($config['station']);
$ch = curl_init($url);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 2, CURLOPT_TIMEOUT => 5]);
$body = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
$data = is_string($body) ? json_decode($body, true) : null;
if ($code !== 200 || !is_array($data) || !isset($data['station'])) { http_response_code(503); echo json_encode(['error'=>'Station unavailable']); exit; }
echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);

exit;
case 'twitch':

header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
$cache=sys_get_temp_dir().'/hfg-twitch-'.hash('sha256',__DIR__).'.json';
if(is_file($cache)&&time()-filemtime($cache)<30){readfile($cache);exit;}
function twitch_public_text($endpoint){$ch=curl_init('https://decapi.me/twitch/'.$endpoint.'/hfgradio');curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>5]);$text=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);return $code===200&&is_string($text)&&strlen($text)<2000?trim($text):null;}
$uptime=twitch_public_text('uptime');$live=null;
if($uptime==='hfgradio is offline')$live=false;
elseif($uptime!==null&&preg_match('/^\d+ (?:second|minute|hour|day|week)s?(?:,? \d+ (?:second|minute|hour|day|week)s?)*$/',$uptime))$live=true;
$title=$live===true?twitch_public_text('title'):'';
if($live===null){http_response_code(503);echo json_encode(['live'=>null,'title'=>'']);exit;}
$json=json_encode(['live'=>$live,'title'=>$title??''],JSON_INVALID_UTF8_SUBSTITUTE);file_put_contents($cache,$json,LOCK_EX);echo $json;

exit;
case 'press':

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$cache=sys_get_temp_dir().'/hfg-press-'.hash('sha256',__DIR__).'.json';
if(is_file($cache)&&time()-filemtime($cache)<300){readfile($cache);exit;}
$url='https://docs.google.com/spreadsheets/d/1U9-_YblzEsajYdhg-IKH8LD-iuUqL_SlZTNAK5lXJwE/gviz/tq?tqx=out:csv';
$ch=curl_init($url);curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>10]);$body=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
if($code!==200||!is_string($body)||str_contains(strtolower($body),'<html')){if(is_file($cache)){$data=json_decode(file_get_contents($cache),true);$data['stale']=true;echo json_encode($data);}else{http_response_code(502);echo json_encode(['error'=>'Press feed unavailable']);}exit;}
$fp=fopen('php://temp','r+');fwrite($fp,$body);rewind($fp);$entries=[];
while(($row=fgetcsv($fp,0,',','"',''))!==false){[$title,$link,$date]=array_pad($row,3,'');$title=trim($title);$link=trim($link);$date=trim($date);if(!$title||!filter_var($link,FILTER_VALIDATE_URL)||!in_array(parse_url($link,PHP_URL_SCHEME),['https','http'],true))continue;$entries[]=['title'=>$title,'url'=>$link,'date'=>$date];}fclose($fp);
$json=json_encode(['entries'=>$entries,'stale'=>false],JSON_INVALID_UTF8_SUBSTITUTE|JSON_UNESCAPED_SLASHES);file_put_contents($cache,$json,LOCK_EX);echo $json;

exit;
default:http_response_code(404);echo json_encode(['error'=>'Not found']);exit;}}
if($path==='/chat.html'||($_GET['view']??'')==='chat'){require __DIR__.'/snippets/chat.php';exit;}
$routes=['/'=>'home','/archive/'=>'archive','/live-in-real-life/'=>'gallery','/links/'=>'links','/imprint/'=>'imprint','/colophon/'=>'colophon'];
$route=$path==='/index.php'||trim($path,'/')===''?'/':'/'.trim($path,'/').'/';
if(!isset($routes[$route])){http_response_code(404);echo 'Page not found';exit;}
$page=$routes[$route];$titles=['home'=>content_value('page.home.title','Radio'),'archive'=>content_value('page.archive.title','Archive'),'gallery'=>content_value('page.gallery.title','Live in real life'),'links'=>content_value('page.links.title','Links'),'imprint'=>content_value('imprint.title','Imprint'),'colophon'=>content_value('colophon.title','Colophon')];$font_url=content_url('site.font.url','/assets/fonts/arial.ttf');$font_format=content_text('site.font.format','truetype');$favicon_url=content_url('site.favicon.url','/material/logofinalb.png');
?><!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?= htmlspecialchars($titles[$page],ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8') ?> — <?= content_text('site.name','HFG RADIO') ?></title><meta name="description" content="<?= content_text('site.description','HFG Radio. Independent radio from Offenbach am Main.') ?>"><link rel="icon" href="<?= $favicon_url ?>"><style>@font-face{font-family:Arial;src:url('<?= $font_url ?>') format('<?= $font_format ?>');font-weight:400;font-display:swap}</style><link rel="stylesheet" href="/assets/styles.css"><script defer src="/assets/script.js"></script><script defer src="/assets/archive.js"></script><script defer src="/assets/gallery.js"></script><script defer src="/assets/press.js"></script><script defer src="/assets/navigation.js"></script></head><body class="<?= $page==='home'?'home':'subpage '.$page.'-page' ?>"><a class="skip" href="#main">Skip to content</a><?php require __DIR__.'/snippets/header.php'; require __DIR__.'/snippets/player.php'; ?><main id="main"><?php foreach($titles as $key=>$title): ?><div data-page="<?= $key ?>" <?= $page!==$key?'hidden':'' ?>><?php require __DIR__.'/snippets/'.$key.'.php'; ?></div><?php endforeach; ?></main><?php require __DIR__.'/snippets/footer.php'; ?><canvas id="dotPatternCanvas" aria-hidden="true"></canvas><script src="/assets/dots.js"></script></body></html>
