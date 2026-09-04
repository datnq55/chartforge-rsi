# ChartForge RSI

ChartForge RSI 3.6.3 vẽ chart nến Binance, RSI và các công cụ phân tích trong cùng dialog. Hai pane dùng chung time scale nên luôn hiển thị đúng cùng tập nến khi kéo hoặc zoom.

## Công thức

- RSI chính: RSI 14 (Wilder/RMA, giống `ta.rsi`)
- Đường nhanh: EMA 9 của RSI
- Đường chậm: WMA 45 của RSI
- Mức 30/70 nét liền; các mức 10–90 và vùng màu mô phỏng script Pine gốc
- Nền trắng bán trong suốt để vẫn nhìn thấy chart phía dưới
- Giữ các region fill trong suốt của Pine gốc; từng bar được tô xanh khi RSI > 80 hoặc cam khi RSI < 20

## Cài đặt

1. Giải nén thư mục này.
2. Mở `chrome://extensions` (Chrome) hoặc `edge://extensions` (Edge).
3. Bật **Developer mode**.
4. Chọn **Load unpacked** và chọn thư mục `chartforge-rsi`.
5. Mở trang Binance Spot dạng `https://www.binance.com/.../trade/BTC_USDT`.

Nhấn biểu tượng extension để bật/tắt. Kéo tiêu đề để di chuyển; kéo bất kỳ cạnh hoặc góc nào của viền dialog để chỉnh chiều rộng và chiều cao.

Kéo ngang trực tiếp trên biểu đồ để xem quá khứ. Nhấp đúp hoặc bấm **Cập nhật** để tải lại dữ liệu và trở về giá hiện tại mà không đổi timeframe.

Trục thời gian theo múi giờ trình duyệt nằm dưới đồ thị và tự đổi định dạng theo timeframe.

Rê chuột trên đồ thị để hiện crosshair dọc bám vào bar gần nhất và nhãn ngày giờ nền tối trên trục thời gian, giống hành vi TradingView.

- Kéo chart giá hoặc RSI: cả hai pane cùng dịch chuyển.
- Cuộn chuột trên chart giá hoặc RSI: cả hai pane cùng zoom.
- Crosshair của hai pane bám cùng một bar.
- Đây là chart giá do extension vẽ từ OHLC Binance, không phải widget chart gốc của Binance.
- Nến tăng: thân trắng, viền và râu đen. Nến giảm: thân, viền và râu đen.
- Kéo phần trục thời gian sang trái/phải để zoom; rê vào trục sẽ có con trỏ hai chiều.
- Kéo chart sang trái để tạo khoảng trắng bên phải mà không sinh nến tương lai.
- Nút **Reset** đưa zoom, vị trí ngang, vị trí dọc và tỷ lệ hai pane về mặc định.
- Nút `✛` bật chế độ kéo chart giá lên/xuống.
- Kéo nút `↕` giữa chart và RSI để thay đổi chiều cao hai pane.
- Dữ liệu realtime được dedupe theo `openTime`; tick chỉ cập nhật nến hiện tại và chỉ thêm khi xuất hiện một openTime mới hợp lệ.
- Zoom bằng trục thời gian giữ bar neo đi theo vị trí con trỏ hiện tại trong suốt thao tác kéo.
- Khi bật `✛`, một lần kéo có thể pan chart đồng thời theo cả chiều ngang và chiều dọc.
- Rê vào price scale bên phải có cursor dọc; kéo lên/xuống để phóng to hoặc thu nhỏ chiều cao nến, giữ mức giá tại điểm nhấn làm anchor.
- Zoom thời gian hỗ trợ tối đa 1.000 bar.
- Tick H4 bám biên ngày/tháng và tự chọn bước 1/2/3/5… ngày theo độ rộng viewport.
- Các tick thời gian có grid dọc mờ chạy xuyên cả chart giá và RSI.
- Hover pane giá có crosshair dọc và ngang; đường ngang kết thúc bằng nhãn giá trên price scale.
- Hover vào một cây nến sẽ hiện O/H/L/C, mức thay đổi và phần trăm thay đổi ở góc trên bên trái của chart giá; màu xanh cho nến tăng và đỏ cho nến giảm.
- Dialog có viền hiển thị rõ và tám vùng resize ở bốn cạnh/bốn góc; kích thước và vị trí mới được ghi nhớ.
- Nút `↕` không nhận focus bàn phím, không hiện caret và không cho chọn ký tự khi nhấn hoặc kéo.
- Toolbar dọc bên trái có công cụ **Fibonacci Retracement**. Chọn `F↗`, đặt điểm đầu rồi đặt điểm cuối; cũng có thể nhấn-kéo-thả để hoàn thành nhanh.
- Fibo gồm các mức `0`, `0.236`, `0.382`, `0.5`, `0.618`, `0.786`, `1`; các đường/vùng dùng màu xám và riêng mức/vùng `0.5` dùng màu hồng.
- Fibo được neo theo thời gian và giá, vì vậy đi cùng nến khi pan/zoom và được lưu riêng theo symbol + timeframe.
- Nhấn vào vùng Fibo để chọn và mở menu công cụ nổi. Menu dùng kiến trúc action chung cho drawing tool; bản này cung cấp nút xóa Fibo.
- Trục thời gian từ `D` trở lên bám ranh giới lịch như TradingView: `D/3D` ưu tiên tháng, `1W/2W` ưu tiên nửa năm, `M` ưu tiên năm; mốc tháng 1 hiển thị năm thay vì `Jan`.
- Mật độ mốc lịch tự thích nghi theo độ rộng và mức zoom, đồng thời grid dọc của chart giá và RSI dùng chung chính xác các mốc này.
- Sửa lỗi khung `M` bị ẩn/hiện nến khi kéo trong trường hợp số nến lịch sử ít hơn số slot đang hiển thị. Các slot thiếu nay là khoảng trắng thật và không còn cắt nến hiện có.
- **Long Position (`L▥`)**: đặt entry và target; hiển thị vùng target xanh, vùng stop đỏ, phần trăm và tỷ lệ risk/reward. Stop mặc định đối xứng với khoảng target.
- **Price Range (`↕$`)**: đo chênh lệch giá và phần trăm giữa hai điểm, với vùng đo xanh và nhãn kết quả.
- **Trend Line (`╱`)**: vẽ đường đỏ 4px giữa hai điểm. Giữ `Shift` trong lúc đặt điểm cuối để khóa thành đường ngang hoặc đường dọc theo hướng gần nhất.
- Ba tool mới dùng chung cơ chế preview, hai-click hoặc kéo-thả, chọn hình, menu nổi và xóa như Fibo.
- Drawing vẫn chỉ lưu trong `chrome.storage.local`; bản này chưa bật đồng bộ giữa các máy theo yêu cầu.
- Kéo trực tiếp drawing để di chuyển toàn bộ đối tượng; kéo các điểm neo màu xanh để sửa từng đầu mút. Long Position có điểm neo riêng cho Entry, Target và Stop.
- Toolbar nổi của drawing có tay nắm và có thể kéo tới vị trí khác.
- Slider Zoom ở bottom toolbar đã được ẩn; zoom bằng chuột và trục thời gian vẫn hỗ trợ tối đa 1.000 bar.
- Bottom toolbar có nút fullscreen; nhấn lại để trở về đúng vị trí và kích thước trước đó.
- Badge thu gọn có thể kéo đi nơi khác; nhấn không kéo để mở lại.
- Bỏ thông báo `+ … khoảng trống` khỏi bottom toolbar và thay các ký tự nút bằng bộ icon SVG đồng nhất.
- Vertical pan được quy đổi theo price range hiện tại: nội dung chart đi đúng quãng đường tương đối với con trỏ ở mọi mức price zoom, không còn trôi nhanh/chậm hơn chuột.
- Long Position khi được chọn có ba đường gióng tới price scale cùng nhãn Target/Entry/Stop màu tương ứng; khi bỏ chọn sẽ ẩn toàn bộ nhãn và điểm neo để chart gọn hơn.
- Price Range luôn giữ nhãn số đo, nhưng chỉ hiện điểm neo và đường gióng giá khi được chọn; đường đo có mũi tên hai đầu như TradingView.
- Khi kéo điểm neo hoặc cả drawing, crosshair ngang và nhãn giá tại con trỏ vẫn hoạt động để đối chiếu chính xác mức giá.
- Giá đóng cửa realtime của nến mới nhất có đường chấm ngang xuyên chart và nhãn nền đen trên price scale như TradingView.
- Price Range giữ nguyên chiều đo A → B: kéo dưới lên cho số dương/mũi tên lên, kéo trên xuống cho số âm/mũi tên xuống. Trục mũi tên luôn nằm chính giữa chiều ngang vùng đo và nhãn nằm ở đầu đích.
- **Text Tool**: chọn biểu tượng `T`, bấm vị trí trên chart và nhập trực tiếp. `Enter` lưu, `Shift+Enter` xuống dòng, `Esc` hủy; text được neo theo thời gian/giá và kéo được như drawing khác.
- Khi chọn Text, toolbar nổi có color picker và font size từ 10–48px; style lưu riêng theo từng text.
- Khi chọn Trend Line, toolbar nổi có color picker, line width 1–8px và kiểu `Solid`, `Dash`, `Dot`; các trend line cũ tự dùng mặc định đỏ, 4px, Solid.
- Sửa lỗi click ra chart khi đang nhập text tạo editor mới và làm mất editor cũ; thao tác này giờ lưu và đóng đúng editor hiện tại.
- Trend Line nay vẽ, chọn, kéo cả đường và chỉnh hai điểm neo được trực tiếp trên pane RSI; hình vẽ vẫn đi cùng time scale chung.
- Toolbar trái rộng hơn, icon SVG nét mảnh được vẽ lại, căn giữa và bỏ hoàn toàn shadow.
- Chế độ kéo dọc chart giá được bật mặc định cho cài đặt mới.
- Bộ logo ChartForge mới được đóng gói ở đủ kích thước 16/32/48/128px và dùng cho icon extension/action.
- Toolbar trái nay là một rail kéo dài từ đỉnh chart tới bottom toolbar; nhóm drawing nằm trên, nút xóa tất cả nằm sát đáy sau separator.
- Nút xóa tất cả xóa bộ drawing dùng chung của symbol đang mở trên mọi timeframe, có bước xác nhận để tránh thao tác nhầm.
- Cài đặt và drawing được ghi đồng thời vào `chrome.storage.sync` và `chrome.storage.local`; dữ liệu local cũ được tự di chuyển lên sync, local tiếp tục làm bản dự phòng.
- Tất cả timeframe của cùng một symbol dùng chung một bộ drawing. Dữ liệu cũ từng lưu riêng theo timeframe được tự gộp và loại bỏ bản trùng khi nâng cấp.
- Text ghi nhớ màu chữ và font size gần nhất; Trend Line ghi nhớ màu, line width và kiểu Solid/Dash/Dot. Preset được dùng cho drawing mới và đồng bộ qua Chrome.
- Logo được thiết kế lại bằng vector phẳng hai màu, không gradient, glow, 3D hay chi tiết thừa; badge thu gọn hiển thị logo thay cho mũi tên.
- Manifest có public key cố định để bản `Load unpacked` giữ cùng Extension ID trên các máy.
- Sync drawing dùng từng item riêng theo `cfrsi:d:<f|t>:<symbol>:<index>` thay vì dồn toàn bộ vào hai key lớn. Local vẫn giữ bản đầy đủ để extension hoạt động khi Chrome Sync đang offline.
- Khai báo icon badge collapse là web-accessible resource riêng cho Binance, sửa lỗi biểu tượng ảnh hỏng trong Shadow DOM.
- Undo/Redo tối đa 100 bước cho tạo, xóa, xóa tất cả, kéo, sửa điểm neo và đổi style drawing. Có nút ở cuối toolbar cùng phím tắt chuẩn; lịch sử chỉ ở RAM của phiên hiện tại, không lưu local/sync.
- Price scale bên phải là lớp nền trắng đặc nằm trên chart/drawing; tick giá, giá realtime, giá hover và nhãn gióng của drawing được render lại trên lớp trên cùng.
- Price scale được nới rộng và toàn bộ phép pan/zoom/hit-test dùng cùng plot width mới, tránh cắt mất chữ số của giá.
- Nhấp đúp Text đã lưu để mở lại editor; Enter hoặc click ra ngoài lưu nội dung mới, Esc hủy. Chỉnh text tham gia Undo/Redo.
- Nhãn giá hover đo đúng chiều rộng logic của canvas theo device-pixel-ratio và tự co font khi chuỗi giá dài, không còn tràn/cắt ở mép phải.

Nút `▾/RSI ▴` thu gọn thành badge vàng nổi và khôi phục panel mà vẫn giữ vị trí, kích thước, timeframe và zoom.

## Lưu ý

- Extension chỉ đọc dữ liệu thị trường công khai từ Binance; không yêu cầu API key và không truy cập lệnh/tài khoản.
- Đây là overlay độc lập, không phải Pine Script chạy native trong TradingView widget của Binance.
- Các khung: H1, H2, H4, H8, H12, D, 3D, 1W, 2W, M. Chỉ khung được chọn mới tải và hiển thị.
- `2W` được tổng hợp từ nến `1W`, vì Spot API không phát interval `2W` trực tiếp.
- Extension tải tối đa 1.000 nến cho thao tác kéo về quá khứ.
