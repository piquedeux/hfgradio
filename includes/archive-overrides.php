<?php
// Public editorial sheet. SoundCloud remains authoritative for playback and artwork.
const HFG_ARCHIVE_SHEET = 'MWZGenowUU5haXFBVGdSZkxOWnFiSXdZYmo0QzNlQUhUeGtEYXp0SHBtZ28=';

function archive_overrides_parse(string $csv): ?array {
 if(strlen($csv)>2000000 || str_contains(strtolower(substr($csv,0,500)),'<html'))return null;
 $stream=fopen('php://temp','r+');fwrite($stream,$csv);rewind($stream);
 $header=fgetcsv($stream,0,',','"','');
 $required=['Titel auf der Website','Datum auf der Website','Künstler*innen','SoundCloud-ID (nicht ändern)'];
 if(!$header || array_diff($required,$header)){fclose($stream);return null;}
 $columns=array_flip($header);$result=[];
 while(($row=fgetcsv($stream,0,',','"',''))!==false){
  $id=trim($row[$columns[$required[3]]]??'');
  if(!preg_match('~^(?:tag:soundcloud,2010:tracks/)?(\d+)$~',$id,$match))continue;
  $id='tag:soundcloud,2010:tracks/'.$match[1];
  if(isset($result[$id])){fclose($stream);return null;} // Ambiguous edits keep the last good sheet.
  $fields=[];
  foreach(['title'=>$required[0],'artist'=>$required[2]] as $key=>$label){$value=trim($row[$columns[$label]]??'');if($value!=='')$fields[$key]=$value;}
  $raw=trim($row[$columns[$required[1]]]??'');
  foreach(['d.m.Y','Y-m-d'] as $format){
   $date=DateTimeImmutable::createFromFormat('!'.$format,$raw,new DateTimeZone('Europe/Berlin'));
   if($date && $date->format($format)===$raw){$fields['created_at']=$date->setTime(12,0)->format(DATE_ATOM);break;}
  }
  $result[$id]=$fields;
 }
 fclose($stream);return $result;
}

function archive_overrides(): array {
 $sheet=base64_decode(HFG_ARCHIVE_SHEET,true);
 $cache=sys_get_temp_dir().'/hfg-archive-overrides-'.hash('sha256',__DIR__.$sheet).'.json';
 $saved=is_file($cache)?json_decode(file_get_contents($cache),true):[];
 if(!is_array($saved))$saved=[];
 if(is_file($cache)&&time()-filemtime($cache)<60)return $saved;
 $ch=curl_init('https://docs.google.com/spreadsheets/d/'.$sheet.'/gviz/tq?tqx=out:csv&sheet=Aufnahmen');
 curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>true,CURLOPT_MAXREDIRS=>3,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_REDIR_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>8]);
 $csv=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
 $rows=$status===200&&is_string($csv)?archive_overrides_parse($csv):null;
 if($rows===null)return $saved;
 $tmp=tempnam(sys_get_temp_dir(),'hfg-archive-edit-');
 if($tmp!==false){file_put_contents($tmp,json_encode($rows,JSON_INVALID_UTF8_SUBSTITUTE));rename($tmp,$cache);}
 return $rows;
}

function archive_title_date(string $title): ?string {
 if(!preg_match_all('/(?<!\d)(\d{1,2})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{4}|\d{2})(?!\d)/',$title,$matches,PREG_SET_ORDER))return null;
 foreach(array_reverse($matches) as $match){
  if(strlen($match[3])===2)$match[3]=2000+(int)$match[3];
  if(checkdate((int)$match[2],(int)$match[1],(int)$match[3]))return (new DateTimeImmutable(sprintf('%04d-%02d-%02d 12:00:00',$match[3],$match[2],$match[1]),new DateTimeZone('Europe/Berlin')))->format(DATE_ATOM);
 }
 return null;
}

function archive_apply_overrides(array $data,array $overrides): array {
 foreach($data['posts'] as &$post){
  $original=$post['created_at'];
  $fields=$overrides[$post['id']]??[];
  // Preserve original timestamps when the displayed calendar day was not edited.
  if(isset($fields['created_at']) && (new DateTimeImmutable($original))->setTimezone(new DateTimeZone('Europe/Berlin'))->format('Y-m-d')===substr($fields['created_at'],0,10))unset($fields['created_at']);
  $post['created_at']=archive_title_date($post['title'])??$original;
  $post=array_replace($post,array_intersect_key($fields,array_flip(['title','artist','created_at'])));
 }
 unset($post);
 usort($data['posts'],fn($a,$b)=>strtotime($b['created_at'])<=>strtotime($a['created_at']));
 return $data;
}

function archive_response(array $data): string {
 return json_encode(archive_apply_overrides($data,archive_overrides()),JSON_INVALID_UTF8_SUBSTITUTE|JSON_UNESCAPED_SLASHES);
}
