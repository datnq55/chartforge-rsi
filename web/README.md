# ChartForge RSI PWA 0.4.15

Đây là static app được GitHub Pages phục vụ trực tiếp. `js/chart-engine.js` là nguồn duy nhất cho chart UI, Canvas renderer, SVG, drawings và Bar Replay. `js/app.js` bổ sung symbol selector, IndexedDB/Firestore, mobile viewport, Binance endpoint và touch controls.

Chạy local:

```bash
npx --yes http-server web -p 4173 -c-1
```

Mở `http://localhost:4173/?symbol=BTCUSDT`.

Topbar, replay bar và bottom toolbar nằm ngoài `chart-workspace`. Price/RSI canvases chỉ nhận kích thước còn lại. Bottom toolbar có separator mỏng toàn chiều ngang; cụm OHLC tự wrap trong plot trên màn hình hẹp và không che price gutter. Mobile theo `visualViewport` và safe-area inset để browser chrome không che toolbar.

Drawing rail hiển thị liền mạch tools, separator, Undo/Redo/Trash, separator và countdown đóng nến dạng thời lượng; countdown ẩn trong Replay. RSI/EMA/WMA nằm bên trái bottom toolbar.

Biểu tượng datum hình học dùng chung cho topbar, favicon, Apple touch icon và icon cài PWA. `assets/icon.svg` là nguồn vector; chạy `npm run icons:pwa` để tái tạo các bản PNG 180/192/512 bằng Chrome cục bộ.

Trash mở confirm dialog dùng chung với thao tác thoát Replay. Hủy không tạo mutation; xác nhận xóa đúng một lần và vẫn khôi phục được bằng Undo.

Time scale dùng lịch UTC phân cấp cho mọi timeframe. Mốc năm/tháng được ưu tiên; nhãn ngày, giờ và phút tự xuất hiện dày dần theo số pixel trên bar và chỉ được vẽ khi không va chạm. Kéo trực tiếp trên time scale thay đổi bar spacing theo tỷ lệ khoảng cách từ con trỏ đến mép phải, giữ nguyên right offset và không trộn thêm thao tác pan; hành vi này dùng chung cho chuột và touch.

Google sign-in là tùy chọn. IndexedDB luôn là nguồn local trước; settings/drawings hợp lệ mới vào Firestore queue. Market cache, Replay và Undo/Redo không đồng bộ. Không thêm service-account hoặc Admin SDK secret.
