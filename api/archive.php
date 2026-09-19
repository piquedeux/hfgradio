<?php
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
