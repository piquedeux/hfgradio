<div id="liveBanner" class="live-banner" hidden role="status" aria-label="<?= content_text('player.live.aria','Live on air') ?>">
    <div class="marquee" aria-hidden="true">
        <?php for ($group = 0; $group < 2; $group++): ?>
        <div class="live-banner-group">
            <?php for ($word = 0; $word < 16; $word++): ?>
            <span><?= content_text('player.live','LIVE') ?></span>
            <?php endfor; ?>
        </div>
        <?php endfor; ?>
    </div>
</div>
