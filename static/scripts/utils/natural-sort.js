define(["exports"],function(e){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.default=function(e,t){var r=/(-?[0-9\.]+)/g,n=e.toString().toLowerCase()||"",a=t.toString().toLowerCase()||"",i=String.fromCharCode(0),o=n.replace(r,i+"$1"+i).split(i),l=a.replace(r,i+"$1"+i).split(i),f=new Date(n).getTime(),u=f?new Date(a).getTime():null;if(u){if(f<u)return-1;if(f>u)return 1}for(var s,g,p=0,c=Math.max(o.length,l.length);p<c;p++){if(s=parseFloat(o[p])||o[p],g=parseFloat(l[p])||l[p],s<g)return-1;if(s>g)return 1}return 0}});
//# sourceMappingURL=../../maps/utils/natural-sort.js.map
