<?php
const HFG_CONTENT_SHEET = '1WoecWeRnfeLaWQV3R4mGwCIy6drd9wm5YGvq-wKVnQk';
function content_editorial_fields() {
 return [
  "Name des Radios" => "site.name",
  "Ort des Radios" => "site.location",
  "Kurzbeschreibung für Suchmaschinen" => "site.description",
  "Startseite – Beschreibung, erster Absatz" => "home.description.1",
  "Startseite – Beschreibung, zweiter Absatz" => "home.description.2",
  "Startseite – Einladung zur Zusammenarbeit" => "home.cooperation",
  "Kontakt – E-Mail-Adresse" => "home.cooperation.email",
  "Instagram – Profil-Link" => "footer.instagram.url",
  "SoundCloud – Profil-Link" => "page.archive.soundcloud.url",
  "Impressum – Name und Ort des Radios" => "imprint.station.value",
  "Impressum – Verantwortliche Person oder Organisation" => "imprint.operator.value",
  "Impressum – Postanschrift" => "imprint.address.value",
  "Impressum – Kontakt-E-Mail" => "imprint.email.value",
  "Credits – Name für Idee und Konzept" => "colophon.idea.name",
  "Credits – Link zu Idee und Konzept" => "colophon.idea.url",
  "Credits – Name für Website-Gestaltung" => "colophon.website.name",
  "Credits – Link zur Website-Gestaltung" => "colophon.website.url",
  "Credits – Erklärung zum Wetterbild" => "colophon.live.text",
  "Credits – Name der Wetterbild-Quelle" => "colophon.live.link",
  "Credits – Link zur Wetterbild-Quelle" => "colophon.live.url",
 ];
}
function content_editorial_only($values) {
 return array_intersect_key($values,array_flip(array_values(content_editorial_fields())));
}
function content_contact_links($values) {
 if(!array_key_exists("home.cooperation.email",$values))return $values;
 $email=trim($values["home.cooperation.email"]??"");
 if(str_starts_with($email,"mailto:"))$email=substr($email,7);
 $values["home.cooperation.email"]=$email;
 $values["home.cooperation.email.url"]=$email!==""?"mailto:".$email:"";
 $values["home.cooperation.email.aria"]=$email;
 return $values;
}
function content_parse_text($text) {
 $values=[];
 foreach(preg_split('/\R/',$text) as $line){
  if($line===''||str_starts_with(ltrim($line),'#')||!str_contains($line,'='))continue;
  [$key,$value]=explode('=',$line,2);$key=trim($key);
  if(preg_match('/^[a-z][a-z0-9_.-]+$/',$key))$values[$key]=str_replace('\\n',"\n",$value);
 }
 return $values;
}
function content_parse_csv($text) {
 if(!is_string($text)||strlen($text)>1000000||str_contains(strtolower($text),'<html'))return [];
 $fields=content_editorial_fields();
 $fp=fopen('php://temp','r+');fwrite($fp,$text);rewind($fp);$values=[];
 while(($row=fgetcsv($fp,0,',','"',''))!==false){
  if(count($row)<2)continue;
  $key=trim($row[0],"\xEF\xBB\xBF \t\r\n");
  if(!isset($fields[$key]))continue;
  $values[$fields[$key]]=str_replace('\\n',"\n",$row[1]);
 }
 fclose($fp);return $values;
}
function content_atomic_write($file,$text) {
 $dir=dirname($file);if(!is_writable($dir))return false;
 $tmp=tempnam($dir,'.hfg-content-');if($tmp===false)return false;
 $ok=file_put_contents($tmp,$text,LOCK_EX)!==false&&@rename($tmp,$file);
 if(is_file($tmp))unlink($tmp);return $ok;
}
function content_values() {
 $file=dirname(__DIR__).'/content.txt';
 $values=is_file($file)?content_parse_text(file_get_contents($file)):[];
 $cache=sys_get_temp_dir().'/hfg-content-editorial-v2-'.hash('sha256',__DIR__.HFG_CONTENT_SHEET).'.json';
 $saved=is_file($cache)?json_decode(file_get_contents($cache),true):null;
 if(is_array($saved))$values=array_replace($values,content_editorial_only($saved['values']??[]));
 if(is_array($saved)&&time()-($saved['checked']??0)<60)return content_contact_links($values);
 // One visitor refreshes; everyone else can use the last successful copy.
 $lock=fopen($cache.'.lock','c');
 if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock)fclose($lock);return content_contact_links($values);}
 if(function_exists('curl_init')){
  $ch=curl_init('https://docs.google.com/spreadsheets/d/'.HFG_CONTENT_SHEET.'/gviz/tq?tqx=out:csv&sheet=Tabellenblatt1');
  curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>true,CURLOPT_MAXREDIRS=>3,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_REDIR_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>5]);
  $body=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
  $remote=$code===200?content_parse_csv($body):[];
  // Reject empty/invalid exports instead of erasing the fallback.
  if(count($remote)>=2&&isset($remote['site.name'])){
   $values=array_replace($values,$remote);
   // Update only editorial fallback lines. Static UI/design lines stay untouched.
   $updates=content_contact_links($remote);
   $lines=is_file($file)?file($file,FILE_IGNORE_NEW_LINES):[];
   foreach($lines as &$line){
    $key=str_contains($line,'=')?trim(explode('=',$line,2)[0]):'';
    if(array_key_exists($key,$updates)){
     $line=$key.'='.str_replace(["\r\n","\r","\n"],'\\n',$updates[$key]);unset($updates[$key]);
    }
   }unset($line);
   foreach($updates as $key=>$value)$lines[]=$key.'='.str_replace(["\r\n","\r","\n"],'\\n',$value);
   content_atomic_write($file,implode("\n",$lines)."\n");
  }
 }
 content_atomic_write($cache,json_encode(['checked'=>time(),'values'=>content_editorial_only($values)],JSON_INVALID_UTF8_SUBSTITUTE));
 flock($lock,LOCK_UN);fclose($lock);return content_contact_links($values);
}
