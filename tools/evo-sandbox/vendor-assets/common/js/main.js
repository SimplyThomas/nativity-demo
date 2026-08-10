/* 
 * Off Canvas Show/Hide
 */
var main = function() {
	/* Push the body and the nav over by 285px over */
	$('.oc-toggler').click(function() {
		if(!$(this).hasClass('open')){
			$('#offcanvas').animate({ right: "0px" }, 200);
			$('body').animate({ right: "265px" }, 200);
			$(this).addClass('open');
		} else {
			$('#offcanvas').animate({ right: "-265px" }, 200);
			$('body').animate({ right: "0px" }, 200);
			$(this).removeClass('open');
		}
	});
	$(window).resize(function() {
		if ($(window).width() > 768) {
			if($('.oc-toggler').hasClass('open')){
				$('#offcanvas').animate({ right: "-265px" }, 200);
				$('body').animate({ right: "0" }, 200);
				$('.oc-toggler').removeClass('open');
			}
		}
	});
};

$(document).ready(main);

/*
 * Side Navigation Sub Menus
 */
!function($){
	$(document).ready(function(){
		$('#offcanvas-menu li.active').addClass('open').children('ul').show();
		$('#offcanvas-menu li.active > a > .toggler').html('<i class="fa fa-times"></i>');
		$('#offcanvas-menu li.has-sub > a ').on('click',function(event){
			event.preventDefault();
			var element=$(this).parent('li');
			if(element.hasClass('open')){
				element.removeClass('open');
				element.find('li').removeClass('open');
				element.find('ul').slideUp(200);
				element.find('.toggler').html('<i class="fas fa-plus"></i>');
			} else { 
				element.addClass('open');
				element.children('ul').slideDown(200);
				element.siblings('li').children('ul').slideUp(200);
				element.siblings('li').removeClass('open');
				element.siblings('li').find('li').removeClass('open');
				element.siblings('li').find('ul').slideUp(200);
				element.find('.toggler').html('<i class="fas fa-times"></i>');
			}
		});
		// Template Switcher Minimizer
		if(sessionStorage.getItem('tsMinimizer') !== 'minimized') {
			$("#minimize").parent().parent().removeClass('minimized');
			$("#minimize").html('<small><i class="fas fa-angle-left"></i> Minimize</small>')
		}
		$("#minimize").click(function(event) {
			event.preventDefault();
			if($(this).parent().parent().hasClass('minimized')){
				$(this).html('<small><i class="fas fa-angle-left"></i> Minimize</small>');
				$(this).parent().parent().removeClass('minimized');
				sessionStorage.setItem('tsMinimizer','expanded');
			}else{
				$(this).html('<small><i class="fas fa-angle-right"></i> Expand</small>');
				$(this).parent().parent().addClass('minimized');
				sessionStorage.setItem('tsMinimizer','minimized');
			};
		});
		$("#scroll-to-content").click(function(event) {
			document.querySelector('main').scrollIntoView({ 
			  behavior: 'smooth',
			  block: 'start'
			});							  
		});
	});
}(jQuery);
$(document).on('click', '#template-switcher-wrapper .dropdown-menu', function (e) {
  e.stopPropagation();
});
/*
 * Bootstrap Carousel Touch Functionaltiy
 */
!function(t) {
    t.fn.bcSwipe = function(e) {
        var n = {
            threshold: 50
        };
        return e && t.extend(n, e), this.each(function() {
            function e(t) {
                1 == t.touches.length && (u = t.touches[0].pageX, c = !0, this.addEventListener("touchmove", o, !1))
            }

            function o(e) {
                if (c) {
                    var o = e.touches[0].pageX,
                        i = u - o;
                    Math.abs(i) >= n.threshold && (h(), t(this).carousel(i > 0 ? "next" : "prev"))
                }
            }

            function h() {
                this.removeEventListener("touchmove", o), u = null, c = !1
            }
            var u, c = !1;
            "ontouchstart" in document.documentElement && this.addEventListener("touchstart", e, !1)
        }), this
    }
}(jQuery);
$('.carousel').bcSwipe({ threshold: 50 });
/*
 * css-vars-ponyfill for IE11 Custom Property Compatibility
 */
cssVars();

//Check Radio Fields in Website Request Form
function domainCheck() {
	if (document.getElementById('ownDomain').checked) {
		document.getElementById('parishDomainNameWrap').style.display = 'initial';
	} else document.getElementById('parishDomainNameWrap').style.display = 'none';
};
function jurisdictionCheck() {
	if (document.getElementById('jurisdiction').value !== 'Greek Orthodox Archdiocese of America') {
		document.getElementById('freeDomain').disabled = true;
		document.getElementById('ownDomain').checked = true;
		document.getElementById('parishDomainName').required = true;
		document.getElementById('parishDomainNameWrap').style.display = 'initial';
	} else {
		document.getElementById('freeDomain').disabled = false;
		document.getElementById('freeDomain').checked = true;
		document.getElementById('parishDomainName').required = false;
		document.getElementById('parishDomainNameWrap').style.display = 'none';
	}
};