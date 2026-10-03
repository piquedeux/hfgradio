<dialog id="siteSearch" aria-labelledby="searchTitle">
 <form method="dialog" class="search-heading"><h2 id="searchTitle"><?= content_text('search.title','Search') ?></h2><button type="submit"><?= content_text('player.close','CLOSE') ?></button></form>
 <label for="searchQuery" class="search-label"><?= content_text('search.title','Search') ?></label>
 <input id="searchQuery" type="search" autocomplete="off" placeholder="<?= content_text('search.placeholder','Search recordings, pages and links…') ?>">
 <p id="searchStatus" role="status"></p><ul id="searchResults"></ul>
</dialog>
