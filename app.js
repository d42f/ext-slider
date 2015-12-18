;angular.module('myApp', [])

.constant('CONST', {
  min: 0,
  max: 100
})

.factory('myService', function (CONST, $window, $document) {
  service = {
    getPos: function (el) {
      var docEl = $document[0].documentElement,
          box = {top: 0, left: 0};

      if (typeof el.getBoundingClientRect !== 'undefined') {
        box = el.getBoundingClientRect();
      }
      return {
        top: box.top  + ($window.pageYOffset || docEl.scrollTop)  - (docEl.clientTop  || 0),
        left: box.left + ($window.pageXOffset || docEl.scrollLeft) - (docEl.clientLeft || 0)
      };
    },
    getSize: function (el) {
      return {
        width: el.offsetWidth || 0,
        height: el.offsetHeight || 0
      };
    },
    getPercent: function (evt, pos, size) {
      percent = Math.round((evt.clientX - pos.left) * (CONST.max - CONST.min) / size.width * 100) / 100;
      return percent < CONST.min ? CONST.min : percent > CONST.max ? CONST.max : percent;
    },
    roundBy: function (n, x) {
      return Math.round(n * Math.pow(10, x)) / Math.pow(10, x);
    },
    normalizeItems: function (items, itemInd) {
      if (items.length < 2) {
        return undefined;
      }

      var sum = CONST.min, aprxm = 0;
      for (var i = items.length; i-- > 0;) {
        aprxm = Math.max(aprxm, (String(items[i].Percent).split('.')[1] || '').length);
        sum += +items[i].Percent;
      }
      if (sum === CONST.max) {
        return undefined;
      }

      var step = sum < CONST.max ? 1 : -1,
          delta = service.roundBy(Math.abs(CONST.max - sum), aprxm);
      while (delta > 0) {
        var editItemInd = null, editItemVal = null;
        for (var i = 0, n = items.length; i < n; i++) {
          var percent = items[i].Percent;
          if (!delta) {
            break;
          }
          if (i === itemInd) {
            continue;
          }
          if (editItemVal === null) {
            editItemInd = i;
            editItemVal = percent;
            continue;
          }
          if (step > 0 && percent < editItemVal && percent < CONST.max) {
            editItemInd = i;
            editItemVal = items[i].Percent;
          }
          if (step < 0 && percent > editItemVal && percent > CONST.min) {
            editItemInd = i;
            editItemVal = percent;
          }
        }
        if (editItemInd === null) {
          throw Error('something wrong');
        }
        if (delta < 1) {
          items[editItemInd].Percent = service.roundBy(+items[editItemInd].Percent + step * delta, aprxm);
          delta = 0;
        } else {
          items[editItemInd].Percent = service.roundBy(+items[editItemInd].Percent + step, aprxm);
          delta -= 1;
        }
      }
    }
  };
  return service;
})

.directive('myClass', function myClassDirective ($parse, $timeout) {
  return function (scope, el, attrs) {
    $timeout(function () {
      var classname = $parse(attrs.myClass)(scope);
      if (classname) {
        el.addClass(classname);
      }
    });
  };
})

.directive('mySlider', function mySliderDirective (CONST, $document, myService) {
  function onSlideMouseDown (evt) {
    var $slider = angular.element(evt.target);
    if (!$slider.hasClass('b-myslider__slider')) {
      return undefined;
    }
    var scope = this.scope,
        itemInd = $slider.attr('data-slider');
    if (!scope.items[itemInd]) {
      return undefined;
    }
    var pos = myService.getPos($slider[0]),
        size = myService.getSize($slider[0]),
        onMouseUp;

    scope.items[itemInd].Percent = myService.getPercent(evt, pos, size);
    if (!scope.$$phase) {
      scope.$apply();
    }

    var onMouseMove = function (evt) {
      scope.items[itemInd].Percent = myService.getPercent(evt, pos, size);
      if (!scope.$$phase) {
        scope.$apply();
      }
    };

    $document.bind('mousemove', onMouseMove);

    $document.bind('mouseup', onMouseUp = function (evt) {
      $document.unbind('mouseup', onMouseUp);
      $document.unbind('mousemove', onMouseMove);
    });
  }

  return {
    restrict: 'AE',
    replace: true,
    transclude: true,
    scope: {
      items: '='
    },
    template: [
      '<div class="b-myslider">',
        '<div class="b-myslider__row" ng-repeat="o in items">',
          '<div class="b-myslider__cell-name"><span ng-bind="o.Name"></span></div>',
          '<div class="b-myslider__cell-slider">',
            '<div class="b-myslider__slider" data-slider="{{$index}}">',
              '<div ng-style="{width: o.Percent - 0 + \'%\'}"></div>',
            '</div>',
          '</div>',
          '<div class="b-myslider__cell-number">',
            '<input type="text" ng-model="o.Percent">',
          '</div>',
        '</div>',
      '</div>'
    ].join(''),
    link: function (scope, el, attrs) {
      if (!angular.isArray(scope.items)) {
        return undefined;
      }
      for (var i = scope.items.length; i-- > 0;) {
        scope.$on('$destroy', scope.$watch('items[' + i + '].Percent', (function (itemInd) {
          return function (nv, ov) {
            if (nv === ov) {
              return undefined;
            }
            if (nv && String(nv).indexOf(',') !== -1) {
              nv = nv.replace(/\,/g, '.');
              scope.items[itemInd].Percent = nv;
            }
            if (!isFinite(+nv)) {
              nv = parseFloat(nv) || ov || 0;
              scope.items[itemInd].Percent = nv;
            }

            nv = nv > CONST.max ? CONST.max : nv < CONST.min ? CONST.min : nv;
            scope.items[itemInd].Percent = nv;

            myService.normalizeItems(scope.items, itemInd);
          };
        })(i)));
      }

      var fn = angular.bind({scope: scope}, onSlideMouseDown);
      el.bind('mousedown', fn);
      scope.$on('$destroy', function () {
        el.unbind('mousedown', fn);
      });
    }
  };
})

.controller('MyAppCtrl', function MyAppCtrl ($scope, $window, $document, $timeout, myService) {
  $document.find('body').removeClass('unready');

  $timeout(function () {
    $scope.items = new Array(Math.round(Math.random() * 5) || 1);
    //$scope.items = new Array(1);

    for (var i = $scope.items.length; i-- > 0;) {
      if (!$scope.items[i]) {
        $scope.items[i] = {
          Name: 'Item ' + (i + 1),
          Percent: Math.round(Math.random() * 100)
        };
      }
    }
    myService.normalizeItems($scope.items);
  }, 1000);
})

;
