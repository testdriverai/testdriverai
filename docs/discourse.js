
  DiscourseEmbed = {
    discourseUrl: 'https://forums.testdriver.ai/',
    discourseEmbedUrl: window.location.href
  };

  (function() {
    var d = document.createElement('script'); d.type = 'text/javascript'; d.async = true;
    d.src = DiscourseEmbed.discourseUrl + 'javascripts/embed.js';
    (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(d);
console.log('Discourse embed script loaded');
  })();
