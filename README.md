# 自研模块加载器

# 项目启动
- pnpm i && pnpm dev

# 使用
1. html 中添加，引入模块加载器文件`index.js`
2. 在`script` 编写要引入的模块，如
```js
 <script>
    startUp.use(['a.js','b.js','c.js'],function (a,b){
        console.log('a,b : ', a,b);
        console.log('start up ...', );
    })
</script>
```
3. startUp 是模块加载器提供函数，主入口
4. 直接在 public/index.html 直接打开页面

# 模块编写
- a.js
```js
define(function (require,exports,module){
    let b = require('b.js')
    console.log('b.sex : ', b);
    exports.age = '30'
})
```
