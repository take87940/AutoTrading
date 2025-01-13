import React, { useRef, useEffect, useState } from 'react';

const url = "https://www.okx.com/api/v5/market/ticker?instId=DOGE-USDT-SWAP";

class Order {
  constructor(id, asset, entryPrice, margin, leverage, status, tp, sl, ma7) {
    this.id = id;          // 訂單的唯一 ID
    this.asset = asset;    // 資產名稱 (例如：BTC, ETH)
    this.entryPrice = entryPrice; //入場價格
    this.margin = margin;  // 保證金數量
    this.leverage = leverage;  // 槓桿倍數
    this.status = status;  // Long(true) or Short
    this.tp = tp;
    this.sl = sl;
    this.ma7 = ma7;
  }
}

//For Notify Telegram
const fetch = require('node-fetch');

const botToken = '7903301344:AAE28RfW1X7yb4SA3SIPWFMs5lKLlKAU5Lw'; // 替換為你的 Bot API Token
const chatId = '6945471691'; // 替換為你的聊天 ID
const Muitiple = 1.1; 

const TrackETHContract = () => {
  //currentPrice
  const [price, setPrice] = useState(0.0);
  //LoadForPage
  const orders = [];
  const [balance, setBalance] = useState(1000);
  const [entryPrice, setEntryPrice] = useState();
  const [margin, setMargin] = useState(1000);
  const [leverage, setLeverage] = useState(1);
  const [status, setStatus] = useState(true);
  const [TP, setTP] = useState();
  const [SL, setSL] = useState();
  const [history, setHistory] = useState([]); // 用來存儲歷史紀錄
  const [profit, setProfit] = useState(0);
  const [entryMa7, setEntryMa7] = useState();
  const [multi_margin, setMulti_margin] = useState(1);

  const [trigger, setTrigger] = useState();
  const triggerRef = useRef(trigger);

  const [wait_EntryPrice, setWait_EntryPrice] = useState();

  //For Entry
  const [E_entryPrice, setE_entryPrice] = useState();
  const [E_margin, setE_margin] = useState(1000);
  const [E_leverage, setE_leverage] = useState(10);
  const [E_TP, setE_TP] = useState();
  const [E_SL, setE_SL] = useState();

  //For page
  const [TP_Profit, setTP_Profit] = useState();
  const [SL_Profit, setSL_Profit] = useState();

  const [autoLong, setAutoLong] = useState();
  
  const [isDisabled, setIsDisabled] = useState(false);

  //For calc MA
  const [closingPrices, setClosingPrices] = useState([]);
  const [ma7, setMa7] = useState(0);




  useEffect(() => {
    //resetHis();
    //resetBal();
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

    const loadMA7FromLocalStorage = () =>
    {
      const savedMA7 = localStorage.getItem("MA7");
      return savedMA7 ? JSON.parse(savedMA7) : [];
    }

    const loadMulti_MarginFromLocalStorage = () =>
    {
      const savedMulti_Margin = localStorage.getItem("multi_margin");
      return savedMulti_Margin ? JSON.parse(savedMulti_Margin) : [];
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
      setTP(parseFloat(loadedOrders[0].tp));
      setSL(parseFloat(loadedOrders[0].sl));
      setEntryMa7(parseFloat(loadedOrders[0].ma7));
    }

    //加載歷史紀錄
    const loadedHistory = loadHistoryFromLocalStorage();
    setHistory(loadedHistory); // 設置歷史紀錄

    //加載MA7
    setClosingPrices(loadMA7FromLocalStorage()); //設置MA7
    
    //加載savedMulti_margin
    setMulti_margin(parseFloat(loadMulti_MarginFromLocalStorage()));

    // Fetch price every 0.11 seconds
    const intervalId = setInterval(fetchPrice, 110);
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  //For 掛單系統
  useEffect(() => {
    if (wait_EntryPrice === null && status !== undefined) {
      if(status)
        entryLong();
      else
        entryShort();
    }
  }, [wait_EntryPrice]);

  const [lastMinuteTime, setLastMinuteTime] = useState(null);
  
  useEffect(()=> {
    if(price === undefined)
      return;

    //For calc MA7
    const now = new Date();
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const times = now.getTime();

    const currentTime = now.getTime(); // 當前的毫秒數
    const currentMinuteTime = Math.floor(currentTime / 60000) * 60000; // 當前分鐘的毫秒數起點（整分）

    // 更新當前價格
    const lastPrice = parseFloat(price);

    // 判斷是否進入新的一分鐘
    console.log('lastMinuteTime', lastMinuteTime, 'currentMinuteTime', currentMinuteTime, 'times', currentTime);
    if (lastMinuteTime === null || currentMinuteTime !== lastMinuteTime) {
      // 保存上一分鐘的收盤價
      if (lastMinuteTime !== null) {
        setClosingPrices((prevPrices) => {
          const updatedPrices = [...prevPrices, lastPrice]; // 保存最後價格作為收盤價
          if (updatedPrices.length > 7) updatedPrices.shift(); // 保留最新 7 個
          return updatedPrices;
        });

        console.log(
          `New minute started at ${new Date(currentMinuteTime)}, closing price: ${lastPrice}`
        );
      }

      // 更新上一分鐘的時間戳
      setLastMinuteTime(currentMinuteTime);
    }

    /*
    console.log("time",times ,  minutes, seconds, price)
    if(seconds == 0)
    {
      setClosingPrices((prevPrices) => {
        const updatedPrices = [...prevPrices, parseFloat(price)];
        if (updatedPrices.length > 7) updatedPrices.shift(); // 保留最新7個
        return updatedPrices;
      });
    }
      */

    if(wait_EntryPrice)
    {
      if(status && price <= wait_EntryPrice)
      { 
        setWait_EntryPrice(null);
        setE_entryPrice(null);
      }
      else if(!status && price >= wait_EntryPrice)
      { 
        setWait_EntryPrice(null);
        setE_entryPrice(null);
      }
    }

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
      
      

      if(status) // Long
      {
        if((TP && price >= TP)) //Long Win
        { 
          setMulti_margin(prevMargin =>prevMargin * Muitiple);
        }else if((SL && price <= SL)) // Long Loss
        {
          setMulti_margin(prevMargin =>prevMargin / Muitiple);
        }
      }
      else // Short
      {
        if((TP && price <= TP)) // Short win
        { 
          setMulti_margin(prevMargin =>prevMargin * Muitiple);
        }else if(SL && price >= SL) // Short Loss
        {
          setMulti_margin(prevMargin =>prevMargin / Muitiple);
        }
      }
    }
  }, [price])

  useEffect(()=>{
    localStorage.setItem("multi_margin", JSON.stringify(multi_margin));
    leave();
  }, [multi_margin])

  // 每次closingPrices更新時，重新計算MA7
  useEffect(() => {
    if (closingPrices.length) {
      localStorage.setItem("MA7", JSON.stringify(closingPrices));
      const sum = closingPrices.reduce((acc, price) => acc + price, 0);
      setMa7(sum / closingPrices.length);
    }
  }, [closingPrices]);

  useEffect(()=>{
    if(entryPrice)
    {
      if(status && ma7)
      {
        if(entryMa7 < ma7)
          setSL(parseFloat(ma7 * 0.99));
      }
      else
      { 
        if(entryMa7 > ma7)
          setSL(parseFloat(ma7 * 1.01));
      }
    }
  }, [ma7])
  //

  //Auto trading
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

  const entryLong = () =>
  { 
    if(wait_EntryPrice)
    {
      alert("已有掛單！")
    }
    else
    {
      if(E_entryPrice)
      {
        setWait_EntryPrice(E_entryPrice);
        setStatus(true);
      }
      else
      {
        if(!entryPrice)
        {
          setEntryPrice(price);
          const new_order = new Order(0, "DOGE", price, E_margin, E_leverage, true, E_TP, E_SL, ma7);
          orders.push(new_order);
          // 儲存持倉資料
          saveOrdersToLocalStorage(orders);

          const loadOrdersFromLocalStorage = () => {
            const savedOrders = localStorage.getItem("orders");
            return savedOrders ? JSON.parse(savedOrders) : [];
          };

          const loadedOrders = loadOrdersFromLocalStorage();
          console.log("loadedOrders", loadedOrders);
          if(loadedOrders.length > 0){
            console.log("hello")
            setEntryPrice(parseFloat(loadedOrders[0].entryPrice));
            setMargin(parseFloat(loadedOrders[0].margin));
            setLeverage(parseInt(loadedOrders[0].leverage));
            setStatus(loadedOrders[0].status);
            setTP(parseFloat(loadedOrders[0].tp));
            setSL(parseFloat(loadedOrders[0].sl));
            setEntryMa7(parseFloat(loadedOrders[0].ma7));
          }
        }
        else
        {
          alert("已有倉位！ 請先平倉")
        }
      }
    }
  }

  const entryShort = () =>
  { 
    if(wait_EntryPrice)
    {
      alert("已有掛單！")
    }
    else
    {
      if(E_entryPrice)
      {
        setWait_EntryPrice(E_entryPrice);
        setStatus(false);
      }
      else
      {
        if(!entryPrice)
          {
            setEntryPrice(price);
            const new_order = new Order(0, "DOGE", price, E_margin, E_leverage, false, E_TP, E_SL, ma7);
            orders.push(new_order);
            // 儲存持倉資料
            saveOrdersToLocalStorage(orders);
            
            const loadOrdersFromLocalStorage = () => {
              const savedOrders = localStorage.getItem("orders");
              return savedOrders ? JSON.parse(savedOrders) : [];
            };

            const loadedOrders = loadOrdersFromLocalStorage();
            console.log("loadedOrders", loadedOrders);
            if(loadedOrders.length > 0){
              console.log("hello")
              setEntryPrice(parseFloat(loadedOrders[0].entryPrice));
              setMargin(parseFloat(loadedOrders[0].margin));
              setLeverage(parseInt(loadedOrders[0].leverage));
              setStatus(loadedOrders[0].status);
              setTP(parseFloat(loadedOrders[0].tp));
              setSL(parseFloat(loadedOrders[0].sl));
              setEntryMa7(parseFloat(loadedOrders[0].ma7));
            }
          }
          else
          {
            alert("已有倉位！ 請先平倉")
          }
      }
    }
  }

  // 儲存持倉資料到 Local Storage
  const saveOrdersToLocalStorage = (orders) => {
    localStorage.setItem("orders", JSON.stringify(orders));
  };

  const leave = async() =>
  { 
    if(!price)
      return;
    setIsDisabled(true);
    const exPrice = price;
    const fee = margin * leverage / 2000 + ((exPrice-entryPrice)/entryPrice + 1)  * margin * leverage / 2000;
    var _profit;
    if(status)
      _profit = parseFloat((exPrice-entryPrice)/entryPrice * margin * leverage);
    else
      _profit = parseFloat((entryPrice-exPrice)/entryPrice * margin * leverage);

    var bal;
    if(status){
      bal = parseFloat(balance - fee + (exPrice-entryPrice)/entryPrice * margin * leverage);
    }else{
      bal = parseFloat(balance - fee + (entryPrice - exPrice)/entryPrice * margin * leverage);
    }
    setBalance(bal);
    setEntryPrice(null);
    //setProfit(0);
    localStorage.removeItem("orders");
    localStorage.setItem("Balance", JSON.stringify(bal));

    const newHistory = [...history, { 
      id: Date.now(), 
      asset: "DOGE", 
      status,
      entryPrice: entryPrice.toFixed(5), 
      exitPrice: exPrice.toFixed(5), 
      profit: (_profit - fee).toFixed(2),
      Amount: (margin * leverage).toFixed(2),
      leverage,
      Fee: (fee).toFixed(2),
      ProfitPercentage: ((_profit - fee) / margin * 100).toFixed(2),
      balance: (bal).toFixed(2),
      ma7:entryMa7.toFixed(5)
    }];
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
    資產: DOGE 數量: ${(margin * leverage).toFixed(2)}USDT (${status ? 'Long' : 'Short'} ${leverage}x)
    入場價格: ${entryPrice} (EntryMA7: ${entryMa7.toFixed(5)}) 出場價格: ${exPrice}
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
    const times = Date.now()
    if(times % 2)
    { // E_margin, E_leverage, true, E_TP, E_SL
      setAutoLong(false);
      setE_margin(1000 * multi_margin);
      setE_leverage(10);
      setE_TP(parseFloat(price * 0.99));
      setE_SL(parseFloat(ma7 * 1.01)); 
      setTrigger(prevTrigger => !prevTrigger); //觸發auto trading
    }
    else
    { 
      setAutoLong(true);
      setE_margin(1000 * multi_margin);
      setE_leverage(10);
      setE_TP(parseFloat(price * 1.01)); 
      setE_SL(parseFloat(ma7 * 0.99)); 
      setTrigger(prevTrigger => !prevTrigger); //觸發auto trading
    }
  }

  // 顯示歷史紀錄
  const renderHistory = () => {
    return history.map((trade, index) => (
      <div key={index}>
        <h3>交易 {index + 1}</h3>
        <span>資產: {trade.asset} 數量: {trade.Amount}USDT ({trade.status ? <span>Long</span> : <span>Short</span>}{trade.leverage}x) </span>
        <div>
          <span>入場價格: {trade.entryPrice} (MA7: {trade.ma7}) 出場價格: {trade.exitPrice}</span>
        </div>
        <div>
          <span>獲利: {trade.profit} USDT ({trade.ProfitPercentage}%) 手續費: {trade.Fee} USDT</span>
        </div>
        <p>帳戶結餘: {trade.balance}</p>
      </div>
    ));
  };

  const E_entryPriceChange = (e) =>
  {
    setE_entryPrice(e.target.value);
  }

  const E_marginChange = (e) =>
  {
    setE_margin(e.target.value);
  }

  const E_leverageChange = (e) =>
  {
    setE_leverage(e.target.value);
  }

  const E_TPChange = (e) =>
  {
    setE_TP(e.target.value);
  }

  const E_SLChange = (e) =>
  {
    setE_SL(e.target.value);
  }

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

  const cancelWait = () =>
  {
    window.location.reload();
  }

  const _TP = () =>
  {
    setPrice(TP);
  }

  const _SL =() =>
  {
    setPrice(SL);
  }



  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', height: '100vh' }}>
    <div style={{ flex: 1, padding: '20px' }}>
      <h1>Real-time DOGE Contract Tracking</h1>
      <h1>Price: {price || "Loading..."}</h1>
      {balance && <h2>Account Balance: {(balance).toFixed(2)} USDT</h2>}
      {entryPrice && <h2>Float Balance: {(profit + balance).toFixed(2)} USDT</h2>}
      <button onClick={resetBal}>resetUSDT</button>
      <div>
        <input placeholder='Pending order(Optional)' type='number' onChange={E_entryPriceChange}></input>
      </div>
      <div>
        <input placeholder='margin' type='number' onChange={E_marginChange}></input>
        <input placeholder='leverage' type='number' onChange={E_leverageChange}></input>
      </div>
      <div>
        <input placeholder='TP(Optional)' type='number' onChange={E_TPChange}></input>
        <input placeholder='SL(Optional)' type='number' onChange={E_SLChange}></input>
      </div>
      <button onClick={entryLong}>entryLong!</button>
      <button onClick={entryShort}>EntryShort!</button>
      {wait_EntryPrice && 
        <div>
          <h2>等待成交...</h2>
          <h3>Price: {wait_EntryPrice}</h3>
          {status && <h3>Status: Long</h3>}
          {!status && <h3>Status: Short</h3>}
          {TP && <h3>TP: {TP}</h3>}
          {SL && <h3>SL: {SL}</h3>}
          <button onClick={cancelWait}>取消掛單</button>
        </div>}
      {entryPrice && 
        <div>
          <h2>EntryPrice: {entryPrice} (Entry MA7: {entryMa7.toFixed(5)})</h2>
          {status && <h3>Status: Long</h3>}
          {!status && <h3>Status: Short</h3>}
          <h2>Amount: {(margin * leverage).toFixed(2)} USDT</h2>
          <h3>Margin: {(margin).toFixed(2)} Leverage: {leverage}x</h3>
          <h3>Open Fee: {(margin * leverage / 2000).toFixed(2)} Close Fee: {(((price - entryPrice) / entryPrice + 1) * margin * leverage / 2000).toFixed(2)}</h3>
          <h3>Profit: {profit.toFixed(2)} ({(profit / margin * 100).toFixed(2)}%)</h3>
          {(status && TP) && <h3>TP: {parseFloat(TP).toFixed(5)} 預估收益: {((TP - entryPrice) / entryPrice * margin * leverage).toFixed(2)} ({((TP - entryPrice) / entryPrice * leverage * 100).toFixed(2)}%)</h3>}
          {(status && SL) && <h3>SL: {parseFloat(SL).toFixed(5)} 預估收益: {((SL - entryPrice) / entryPrice * margin * leverage).toFixed(2)} ({((SL - entryPrice) / entryPrice * leverage * 100).toFixed(2)}%)</h3>}
          {(!status && TP) && <h3>TP: {parseFloat(TP).toFixed(5)} 預估收益: {((entryPrice - TP) / entryPrice * margin * leverage).toFixed(2)} ({((entryPrice - TP) / entryPrice * leverage * 100).toFixed(2)}%)</h3>}
          {(!status && SL) && <h3>SL: {parseFloat(SL).toFixed(5)} 預估收益: {((entryPrice - SL) / entryPrice * margin * leverage).toFixed(2)} ({((entryPrice - SL) / entryPrice * leverage * 100).toFixed(2)}%)</h3>}
          <button onClick={leave} disabled={isDisabled}>Leave</button>
          <button onClick={_TP}>TP</button>
          <button onClick={_SL}>SL</button>
        </div>
      }
      <div>
        <h2>Moving Average (MA7): {parseFloat(ma7).toFixed(5)}</h2>
        <h3>Closing Prices: {closingPrices.join(", ")}</h3>
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

export default TrackETHContract;
