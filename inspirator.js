RefSearch = {
  searchTag : function(tag) {
    var object = byId('refSearch').getElementsByTagName('object')[0];
    var etag = encodeURIComponent(tag);
    var newObject = OBJECT(
      PARAM({
        name:'flashvars',
        value: (
          'offsite=true&lang=en-us&page_show_url=%2Fphotos%2Ftags%2F'+etag+
          '%2Fshow%2F&page_show_back_url=%2Fphotos%2Ftags%2F'+etag+
          '%2F&tags='+etag+
          '&jump_to=&start_index='
        )
      }),
      PARAM({ name:'movie', value:'http://www.flickr.com/apps/slideshow/show.swf?v=71649' }),
      PARAM({ name:'allowFullScreen', value:'true' }),
    {width:300, height:300});
    object.parentNode.insertBefore(newObject, object);
    object.parentNode.removeChild(object);
  }
};

Inspirator = {
  nouns : 'animal bird mammal herbivore carnivore fish amphibian reptile human man woman child boy girl plant rock machine tragedy mountain river lake ocean cliff beach plain forest city suburb downtown sky storm sun cloud rain thunder snow hurricane table chair desk hotel restaurant shop mall road street tool'.split(' '),
  verbs : 'dive swim crawl walk run jump swing glide fly sit help hinder ignore follow avoid read drive eat talk grow shrink risk get lose keep borrow buy sell farm hunt build deconstruct analyze teach understand mistake sleep'.split(' '),
  randomTheme : function() {
    var r = Math.random();
    var s = [];
    for (var i=0; i<r*4; i++) {
      s.push( (i%2 ? this.verbs : this.nouns).random() );
    }
    return s.join('-');
  }
};

