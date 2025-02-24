// 2025.1.19更: 日期紀錄 及 EL紀錄

import React, { useRef, useEffect, useState } from 'react';

const Coin = "DOGE";

const url = "https://www.okx.com/api/v5/market/ticker?instId=" + Coin + "-USDT-SWAP";

class Order {
  constructor(id, asset, entryPrice, margin, leverage, status) {
    this.id = id;          // 訂單的唯一 ID
    this.asset = asset;    // 資產名稱 (例如：BTC, ETH)
    this.entryPrice = entryPrice; //入場價格
    this.margin = margin;  // 保證金數量
    this.leverage = leverage;  // 槓桿倍數
    this.status = status;  // Long(true) or Short
  }
}

//For Notify Telegram
const fetch = require('node-fetch');

const botToken = '7903301344:AAE28RfW1X7yb4SA3SIPWFMs5lKLlKAU5Lw'; // 替換為你的 Bot API Token
const chatId = '6945471691'; // 替換為你的聊天 ID

const TrackETHContract2 = () => {
  const round_seconds = 1800; //時間週期
  const multi = 1.1; //倍增倍率
  const L = 10.0; //初始槓桿倍數

  const [NKH, setNKH] = useState(); // Now K High
  const [NKL, setNKL] = useState(); // Now K Low

  const [FKH, setFKH] = useState(); // Fore K High
  const [FKL, setFKL] = useState(); // Fore K Low

  //
  const [recordMPieces, setRecordMPieces] = useState([]);
  //currentPrice
  const [price, setPrice] = useState(0.0);

  //History Order
  const orders = [];
  const [history, setHistory] = useState([]); // 用來存儲歷史紀錄

  //Account Info
  const [balance, setBalance] = useState(1000);
  const [profit, setProfit] = useState(0);

  //當前持倉資訊
  const [entryPrice, setEntryPrice] = useState();
  const [margin, setMargin] = useState(1000);
  const [leverage, setLeverage] = useState(L);
  const [status, setStatus] = useState(true);

  //Auto Trade
  const [trigger, setTrigger] = useState();
  const triggerRef = useRef(trigger);
  const [autoLong, setAutoLong] = useState();
  const [contiCount, setCountiCount] = useState(1);
  var isEL = false;
  var nowTime;

  const [isDisabled, setIsDisabled] = useState(false);

  //Info
  const [openingPrices, setOpeningPrices] = useState(null);
  const [time, setTime] = useState();


  useEffect(() => {
    //Function
    const fetchPrice = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Network response was not ok ' + response.statusText);
        }
        const data = await response.json();
        const _price = data.data[0].last;
        setPrice(parseFloat(_price));
      } catch (error) {
        console.error("Error fetching price:", error);
      }
    };

    // 從 Local Storage 加載持倉資料
    const loadOrdersFromLocalStorage = () => 
    {
      const savedOrders = localStorage.getItem("orders");
      return savedOrders ? JSON.parse(savedOrders) : [];
    };

    const loadUserBalanceLocalStorage = () =>
    {
      const savedBal = localStorage.getItem("Balance");
      return savedBal ? JSON.parse(savedBal) : balance;
    };
    
    const loadHistoryFromLocalStorage = () => 
    {
      const savedHistory = localStorage.getItem("history");
      return savedHistory ? JSON.parse(savedHistory) : [];
    };

    const loadOpeningPrice = () =>
    {
      const savedOpeningPrice = localStorage.getItem("OpeningPrice");
      return savedOpeningPrice ? JSON.parse(savedOpeningPrice) : null;
    }

    const loadOpeningPrices = () =>
    {
      const savedOpeningPrices = localStorage.getItem("OpeningPrices");
      return savedOpeningPrices ? JSON.parse(savedOpeningPrices) : [];
    }

    const loadFKH = () =>
    { 
      const savedFKH = localStorage.getItem("FKH");
      return savedFKH ? JSON.parse(savedFKH) : null;
    }

    const loadFKL = () =>
    {
      const savedFKL = localStorage.getItem("FKL");
      return savedFKL ? JSON.parse(savedFKL) : null;
    }

    const loadNKH = () =>
    {
      const savedNKH = localStorage.getItem("NKH");
      console.log("SS", savedNKH);
      return savedNKH ? JSON.parse(savedNKH) : null;
    }

    const loadNKL = () =>
    {
      const savedNKL = localStorage.getItem("NKL");
      return savedNKL ? JSON.parse(savedNKL) : null;
    }

    const loadCountiCount = () =>
    {
      const savedCountiCount = localStorage.getItem("CountiCount");
      return savedCountiCount ? JSON.parse(savedCountiCount) : null;
    }
    //

    // 加載持倉資料
    const bal = parseFloat(loadUserBalanceLocalStorage());
    setBalance(bal);
    const loadedOrders = loadOrdersFromLocalStorage();
    console.log("loadedOrders", loadedOrders);
    if(loadedOrders.length > 0){
      console.log("hello")
      setEntryPrice(parseFloat(loadedOrders[0].entryPrice));
      setMargin(parseFloat(loadedOrders[0].margin));
      setLeverage(parseInt(loadedOrders[0].leverage));
      setStatus(loadedOrders[0].status);
    }

    //加載OpeningPrice、OpeningPrices
    setOpeningPrices(parseFloat(loadOpeningPrice()));
    setRecordMPieces(loadOpeningPrices());

    //加載K棒紀錄
    setFKH(parseFloat(loadFKH()));
    setFKL(parseFloat(loadFKL()));
    setNKH(parseFloat(loadNKH()));
    setNKL(parseFloat(loadNKL()));

    //加載CountiCount
    setCountiCount(parseInt(loadCountiCount()));

    //加載歷史紀錄
    const loadedHistory = loadHistoryFromLocalStorage();
    setHistory(loadedHistory); // 設置歷史紀錄
    //


    // Fetch price every 0.2 seconds
    const intervalId = setInterval(fetchPrice, 200);
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const [lastMinuteTime, setLastMinuteTime] = useState(null);
  
  useEffect(()=> {
    if(price === undefined || price == 0)
      return;

    const now = new Date();
    const currentTime = now.getTime(); // 當前的毫秒數
    const currentMinuteTime = Math.floor(currentTime / round_seconds / 1000) * round_seconds * 1000; // 當前分鐘的毫秒數起點（整分）

    // 取得當前時間戳
    const timestamp = Date.now();

    // 創建一個新的 Date 物件
    const date = new Date(timestamp);

    // 設置台灣時區（UTC+8）
    const options = {
      timeZone: 'Asia/Taipei',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false // 使用 24 小時制
    };

    // 格式化日期
    const formattedTime = date.toLocaleTimeString('en-US', options);
    nowTime = formattedTime;
    setTime(formattedTime);
    //

    // 更新當前價格
    const lastPrice = parseFloat(price);
    
    // Early Leave
    if(status) // Long 破前低則市價止損 入Short
    {
      if(price < FKL)
      {
        setAutoLong(false);
        isEL = true;
        setCountiCount(1);
        localStorage.setItem("CountiCount", JSON.stringify(1));
        leave();
        setTrigger(prevTrigger => !prevTrigger);
        isEL = false;
      }
    }
    else //Short 破前低則市價止損 入Long
    {
      if(price > FKH)
      {
        setAutoLong(true);
        isEL = true;
        setCountiCount(1);
        localStorage.setItem("CountiCount", JSON.stringify(1));
        leave();
        setTrigger(prevTrigger => !prevTrigger);
        isEL = false;
      }
    }
    //

    // 判斷是否進入新的一分鐘
    //console.log('lastMinuteTime', lastMinuteTime / 1000, 'currentMinuteTime', currentMinuteTime / 1000, 'times', currentTime / 1000);
    if (lastMinuteTime === null || currentMinuteTime !== lastMinuteTime) {

      if(lastMinuteTime == null || NKH == NKL)
      {
        setLastMinuteTime(currentMinuteTime);
      }
      else
      {
        console.log("Change M!");
        const H = NKH;
        const L = NKL;  
        //存下FK狀態
        setFKH(H);
        localStorage.setItem("FKH", JSON.stringify(H));
        console.log("設置FKH", H)
        setFKL(L);
        localStorage.setItem("FKL", JSON.stringify(L));
        console.log("設置FKL", L);
        //
        //Reset K棒狀態
        setNKH(lastPrice);
        setNKL(lastPrice);
        localStorage.setItem("NKH", JSON.stringify(lastPrice));
        localStorage.setItem("NKL", JSON.stringify(lastPrice));
        //
        setRecordMPieces((prevPrices) => {
          const updatedPrices = [...prevPrices, lastPrice]; // 保存最後價格作為收盤價
          if (updatedPrices.length > 7) updatedPrices.shift(); // 保留最新 7 個
          localStorage.setItem("OpeningPrices", JSON.stringify(updatedPrices));
          return updatedPrices;
        });
        //目前為 舊盤收盤 新盤開始階段
        //若無紀錄先儲存 有紀錄則比較開盤 收盤價判斷漲跌
        if (!openingPrices) {
          setOpeningPrices(lastPrice);
          localStorage.setItem("OpeningPrice", JSON.stringify(lastPrice));
          console.log(`New minute started at ${new Date(currentMinuteTime)}, opening price: ${lastPrice}`);
        }
        else
        { 
          var foreKState = lastPrice > openingPrices; 
          setOpeningPrices(lastPrice);
          localStorage.setItem("OpeningPrice", JSON.stringify(lastPrice));
          //若方向一樣 => 不變
          //不同則平倉後 朝foreKState走
          if(foreKState !== status) 
          {
            setAutoLong(foreKState);
            setCountiCount(1);
            localStorage.setItem("CountiCount", JSON.stringify(1));
            leave();
            setTrigger(prevTrigger => !prevTrigger); //觸發交易
          }
          else
          { 
            localStorage.setItem("CountiCount", JSON.stringify(contiCount + 1));
            setCountiCount(prevCountiCount => prevCountiCount + 1);
          }
        }
        

        // 更新上一分鐘的時間戳
        setLastMinuteTime(currentMinuteTime);
      }
    }

    //若目前有持倉 => 計算浮盈
    if(entryPrice)
    { 
      if(status)
      {
        const _profit = parseFloat(((price-entryPrice)/entryPrice * margin * leverage));
        setProfit(_profit);
      }else{
        const _profit = parseFloat(((entryPrice-price)/entryPrice * margin * leverage));
        setProfit(_profit);
      }
    }

    //更新Now K High Low
    if(!NKH || price > NKH)
    {
      setNKH(price);
      localStorage.setItem("NKH", price);
    }
    if(!NKL || price < NKL)
    {
      setNKL(price);
      localStorage.setItem("NKL", price);
    }
  }, [price])
  //

  //Auto trading(變動trigger => Look "autoLong" 決定入場方向入場)
  useEffect(()=>{
    if (trigger !== triggerRef.current) {
      triggerRef.current = trigger;
      console.log("Tri", trigger);
      if(autoLong)
        entryLong();
      else
        entryShort();
    }
  }, [trigger]);
  //

  //市價入場 多
  const entryLong = () =>
  { 
    //無持倉才開倉
    if(!entryPrice)
    {
      setEntryPrice(price);
      const new_order = new Order(0, Coin, price, margin, leverage, true);
      orders.push(new_order);
      // 儲存持倉資料
      saveOrdersToLocalStorage(orders);

      const loadOrdersFromLocalStorage = () => {
        const savedOrders = localStorage.getItem("orders");
        return savedOrders ? JSON.parse(savedOrders) : [];
      };

      const loadedOrders = loadOrdersFromLocalStorage();
      if(loadedOrders.length > 0){
        setEntryPrice(parseFloat(loadedOrders[0].entryPrice));
        setMargin(parseFloat(loadedOrders[0].margin));
        setLeverage(parseInt(loadedOrders[0].leverage));
        setStatus(loadedOrders[0].status);
      }
    }
    else
    {
      alert("已有倉位！ 請先平倉")
    }
  }

  //市價入場 空
  const entryShort = () =>
  { 
    if(!entryPrice)
      {
        setEntryPrice(price);
        const new_order = new Order(0, Coin, price, margin, leverage, false);
        orders.push(new_order);
        // 儲存持倉資料
        saveOrdersToLocalStorage(orders);
        
        const loadOrdersFromLocalStorage = () => {
          const savedOrders = localStorage.getItem("orders");
          return savedOrders ? JSON.parse(savedOrders) : [];
        };

        const loadedOrders = loadOrdersFromLocalStorage();
        if(loadedOrders.length > 0){
          setEntryPrice(parseFloat(loadedOrders[0].entryPrice));
          setMargin(parseFloat(loadedOrders[0].margin));
          setLeverage(parseInt(loadedOrders[0].leverage));
          setStatus(loadedOrders[0].status);
        }
      }
      else
      {
        alert("已有倉位！ 請先平倉")
      }
  }

  // 儲存持倉資料到 Local Storage
  const saveOrdersToLocalStorage = (orders) => {
    localStorage.setItem("orders", JSON.stringify(orders));
  };

  //平倉
  const leave = async() =>
  { 
    //結算
    if(!price || !entryPrice)
      return;
    setIsDisabled(true);
    const exPrice = price;
    const fee = margin * leverage / 2000 + ((exPrice-entryPrice)/entryPrice + 1)  * margin * leverage / 2000;
    var _profit;
    if(status)
      _profit = parseFloat((exPrice-entryPrice)/entryPrice * margin * leverage);
    else
      _profit = parseFloat((entryPrice-exPrice)/entryPrice * margin * leverage);

    var bal = balance;
    
    if(status){
      bal = parseFloat(balance - fee + (exPrice-entryPrice)/entryPrice * margin * leverage);
    }else{
      bal = parseFloat(balance - fee + (entryPrice - exPrice)/entryPrice * margin * leverage);
    }
    
    if(bal < balance) //Loss
    {
      var M = leverage * multi;
      setLeverage(M);
    }
    else
    {
      setLeverage(L);
    }

    setBalance(bal);
    setEntryPrice(null);
    localStorage.removeItem("orders");
    localStorage.setItem("Balance", JSON.stringify(bal));
    //

    const newHistory = [...history, { 
      id: Date.now(), 
      asset: Coin, 
      status,
      contiCount,
      entryPrice: entryPrice.toFixed(5), 
      exitPrice: exPrice.toFixed(5), 
      profit: (_profit - fee).toFixed(2),
      Amount: (margin * leverage).toFixed(2),
      leverage,
      Fee: (fee).toFixed(2),
      ProfitPercentage: ((_profit - fee) / margin * 100).toFixed(2),
      balance: (bal).toFixed(2),
      isEL,
      nowTime,
    }];
    console.log(entryPrice, isEL);
    setHistory(newHistory);
    localStorage.setItem("history", JSON.stringify(newHistory)); // 儲存歷史紀錄到 LocalStorage

    //For telegram
    // 取得當前時間戳
    const timestamp = Date.now();

    // 創建一個新的 Date 物件
    const date = new Date(timestamp);

    // 設置台灣時區（UTC+8）
    const options = {
      timeZone: 'Asia/Taipei',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false // 使用 24 小時制
    };

    // 格式化日期
    const formattedTime = date.toLocaleTimeString('en-US', options);

    const message = `
    交易 ${formattedTime}
    資產: ${Coin} 數量: ${(margin * leverage).toFixed(2)}USDT (${status ? 'Long' : 'Short'} ${leverage}x)
    入場價格: ${entryPrice} 出場價格: ${exPrice}
    獲利: ${(_profit - fee).toFixed(2)} USDT (${((_profit - fee) / margin * 100).toFixed(2)}%) 手續費: ${(fee).toFixed(2)} USDT
    帳戶結餘: ${bal.toFixed(2)}
    `;

    let retryCount = 0;
    const maxRetries = 5;  // 最大重試次數

    // 使用 async 函數來處理發送消息
    async function sendMessage() {
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
          }),
        });

        const data = await response.json();

        if (data.ok) {
          console.log('成功發送消息到 Telegram:', data);
          // 成功發送後，執行後續操作
          // 您可以在這裡進行其他步驟，譬如觸發其他功能
        } else {
          throw new Error('Telegram API 發生錯誤');
        }
      } catch (error) {
        console.error('消息發送失敗:', error);
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`重試次數: ${retryCount}`);
          // 如果失敗，則在 1 秒後重試
          // setTimeout(sendMessage, 5000);
        } else {
          console.error('達到最大重試次數，發送失敗');
        }
      }
    }
    // 開始發送訊息
    await sendMessage();
    //
  }

  // 顯示歷史紀錄
  const renderHistory = () => {
    return history.map((trade, index) => (
      <div key={index}>
        <h3>交易 {index + 1} ({trade.nowTime} {trade.isEL && <span>EL</span>})</h3>
        <span>資產: {trade.asset} 數量: {trade.Amount}USDT ({trade.status ? <span>Long + {trade.contiCount}</span> : <span>Short + {trade.contiCount}</span>}) ({trade.leverage}x) </span>
        <div>
          <span>入場價格: {trade.entryPrice} 出場價格: {trade.exitPrice}</span>
        </div>
        <div>
          <span>獲利: {trade.profit} USDT ({trade.ProfitPercentage}%) 手續費: {trade.Fee} USDT</span>
        </div>
        <p>帳戶結餘: {trade.balance}</p>
      </div>
    ));
  };

  const resetBal = () =>
  {
    setBalance(1000);
    localStorage.setItem("Balance", JSON.stringify(1000));
  }

  const resetHis = () =>
  {
    localStorage.clear("history");
    setHistory([]);
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', height: '100vh' }}>
    <div style={{ flex: 1, padding: '20px' }}>
      <h1>Real-time {Coin} Contract Tracking</h1>
      <h2>{time}</h2>
      <h1>Price: {price || "Loading..."}</h1>
      {balance && <h2>Account Balance: {(balance).toFixed(2)} USDT</h2>}
      {entryPrice && <h2>Float Balance: {(profit + balance).toFixed(2)} USDT</h2>}
      <button onClick={resetBal}>resetUSDT</button>
      <button onClick={entryLong}>entryLong!</button>
      <button onClick={entryShort}>EntryShort!</button>
      {entryPrice && 
        <div>
          <h2>EntryPrice: {entryPrice}</h2>
          {status && <h3>Status: Long + {contiCount}</h3>}
          {!status && <h3>Status: Short + {contiCount}</h3>}
          <h2>Amount: {(margin * leverage).toFixed(2)} USDT</h2>
          <h3>Margin: {(margin).toFixed(2)} Leverage: {leverage}x</h3>
          <h3>Open Fee: {(margin * leverage / 2000).toFixed(2)} Close Fee: {(((price - entryPrice) / entryPrice + 1) * margin * leverage / 2000).toFixed(2)}</h3>
          <h3>Profit: {profit.toFixed(2)} ({(profit / margin * 100).toFixed(2)}%)</h3>
          <button onClick={leave} disabled={isDisabled}>Leave</button>
        </div>
      }
      <div>
        <h2>Round Time: {round_seconds}</h2>
        <h3>Opening Prices: {openingPrices}</h3>
        <h3>Opening Prices: {recordMPieces.join(", ")}</h3>
        { price > openingPrices ? <h3>目前為漲K</h3> : <h3>目前為跌K</h3>}
        <h3>FK High:{FKH}</h3>
        <h3>FK Low:{FKL}</h3>
        <h3>K High:{NKH}</h3>
        <h3>K Low:{NKL}</h3>
    </div>
    </div>
    
    {/* 右半部分顯示歷史紀錄 */}
    <div style={{ flex: 1, padding: '20px', overflowY: 'auto', height: '100vh' }}>
      <h2>History</h2>
      <button onClick={resetHis}>清空歷史交易紀錄</button>
      <div style={{ marginTop: '20px', overflowY: 'scroll', height: '90vh' }}>
        {renderHistory()}
      </div>
    </div>
  </div> 
  );
};

export default TrackETHContract2;
