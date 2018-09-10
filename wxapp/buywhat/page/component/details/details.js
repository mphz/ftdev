// page/component/details/details.js
Page({
  data:{
    goods: {
      id: 1,
      image: '/image/redpomelo.png',
      title: '正宗梅州当季红肉蜜柚',
      price: 5.98,
      stock: '有货',
      detail: '正宗梅州当季红肉蜜柚详情',
      parameter: '1000克(2斤)/个',
      service: '不支持退货，敬请谅解'
    },
    num: 1,
    totalNum: 0,
    hasCarts: false,
    curIndex: 0,
    show: false,
    scaleCart: false
  },

  addCount() {
    let num = this.data.num;
    num++;
    this.setData({
      num : num
    })
  },

  minusCount() {
    let num = this.data.num;
    num--;
    this.setData({
      num: num
    })
  },

  addToCart() {
    const self = this;
    const num = this.data.num;
    let total = this.data.totalNum;

    self.setData({
      show: true
    })
    setTimeout( function() {
      self.setData({
        show: false,
        scaleCart : true
      })
      setTimeout( function() {
        self.setData({
          scaleCart: false,
          hasCarts : true,
          totalNum: num + total
        })
      }, 200)
    }, 300)

  },

  bindTap(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.setData({
      curIndex: index
    })
  }
 
})