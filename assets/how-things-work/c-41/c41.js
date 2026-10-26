(() => {
'use strict';
// src/process-model.mjs
// Progress describes the illustrated path, not chemical dwell time.
const DEVELOPER_REFERENCE = Object.freeze({ temperatureC: 37.8, seconds: 195 });
const developerTemperature = `${DEVELOPER_REFERENCE.temperatureC.toLocaleString("vi-VN")} °C`;
const developerDuration = `${Math.floor(DEVELOPER_REFERENCE.seconds / 60)} phút ${DEVELOPER_REFERENCE.seconds % 60} giây`;

const STAGES = Object.freeze([
  {
    id: "load",
    index: 0,
    title: "Nạp phim",
    english: "LIGHT-TIGHT LOADING",
    description: "Đầu phim được nối với tấm dẫn. Con lăn đưa tấm dẫn và dải phim vào buồng xử lý kín sáng; ảnh lúc này vẫn chỉ là ảnh tiềm ẩn trong nhũ tương.",
    filmState: "Ảnh tiềm ẩn · còn nhạy sáng",
    note: "Phim màu phải tránh ánh sáng cho đến khi định hình xong. Đèn đỏ phòng tối cũng không an toàn cho phim C‑41.",
    metric: { value: "Kín sáng", label: "Điều kiện bắt buộc trước khi định hình xong" },
  },
  {
    id: "develop",
    index: 1,
    title: "Hiện màu",
    english: "COLOR DEVELOPER",
    description: "Thuốc hiện khử các hạt muối bạc đã nhận ánh sáng thành bạc kim loại. Sản phẩm oxy hóa của thuốc hiện phản ứng với chất tạo màu trong các lớp nhũ tương, tạo nên hình ảnh bằng thuốc nhuộm.",
    filmState: "Hình ảnh màu hình thành cùng bạc kim loại",
    note: `Tham chiếu C‑41 tiêu chuẩn: hiện màu ở ${developerTemperature} trong ${developerDuration}. Khi vận hành thật phải theo tài liệu của hóa chất và máy cụ thể.`,
    metric: { value: developerTemperature, label: `Hiện màu · tham chiếu ${developerDuration}` },
  },
  {
    id: "bleach",
    index: 2,
    title: "Tẩy bạc",
    english: "BLEACH",
    description: "Dung dịch tẩy oxy hóa bạc kim loại, chuyển nó trở lại dạng muối bạc để thuốc định loại bỏ ở bước sau. Hình ảnh thuốc nhuộm màu được giữ lại.",
    filmState: "Thuốc nhuộm màu và muối bạc",
    note: "Tẩy bạc không có nghĩa là tẩy mất ảnh màu. Bước này chuẩn bị loại bỏ bạc, chưa hoàn tất việc loại bạc khỏi phim.",
    metric: { value: "Chuyển hóa bạc", label: "Bạc kim loại trở lại dạng muối bạc" },
  },
  {
    id: "fix",
    index: 3,
    title: "Định hình",
    english: "FIXER",
    description: "Thuốc định hòa tan muối bạc chưa được hiện và lượng muối bạc vừa chuyển hóa ở bể tẩy. Sau khi định hình hoàn tất, hình ảnh còn lại chủ yếu là thuốc nhuộm màu.",
    filmState: "Các muối bạc đang được loại bỏ",
    note: "Chỉ coi phim đã an toàn với ánh sáng sau khi định hình hoàn tất; không mở máy ngay khi phim vừa vào bể này.",
    metric: { value: "Loại muối bạc", label: "Hoàn tất định hình rồi mới đưa ra ánh sáng" },
  },
  {
    id: "rinse",
    index: 4,
    title: "Rửa & tráng cuối",
    english: "WASH / FINAL RINSE",
    description: "Các bước rửa loại hóa chất còn dư. Dung dịch tráng cuối được dùng theo quy trình của hệ hóa chất, giúp bề mặt phim khô đều và hạn chế vết nước.",
    filmState: "Âm bản còn ướt · đã định hình",
    note: "Hình minh họa gộp các bước rửa và tráng cuối. Máy thật có thể có bể rửa trung gian và nhiều bể nối tiếp, không chỉ một ngăn như hình.",
    metric: { value: "Âm bản còn ướt", label: "Rửa sạch và xử lý bề mặt trước khi sấy" },
  },
  {
    id: "dry",
    index: 5,
    title: "Sấy khô",
    english: "FILTERED-AIR DRYER",
    description: "Không khí ấm được lọc thổi qua dải phim, làm nước bay hơi trước khi phim ra khay nhận. Dải âm bản khô sau đó mới được cắt, scan hoặc dùng để phóng ảnh.",
    filmState: "Âm bản đang khô · sẵn sàng nhận sau khi sấy",
    note: "Máy tráng không biến âm bản thành ảnh số và không in ảnh. Scan và phóng ảnh là những công đoạn riêng.",
    metric: { value: "Âm bản", label: "Đầu ra của máy tráng · chưa phải ảnh số" },
  },
].map((stage) => Object.freeze({ ...stage, metric: Object.freeze(stage.metric) })));

const PROCESS_NOTES = Object.freeze([
  "Vỏ máy được cắt mở chỉ để giải thích. Máy thật phải kín sáng cho đến khi định hình hoàn tất.",
  "Tiến độ là vị trí minh họa qua sáu công đoạn, không phải đồng hồ tráng thực tế. Chiều dài đường phim và tốc độ kéo quyết định thời gian lưu trong từng bể.",
  "Cấu hình đã giản lược các bể rửa trung gian và các bể lặp. Thông số vận hành phụ thuộc máy, hóa chất và quy trình; hình này không thay thế hướng dẫn kỹ thuật.",
  "Máy giữ điều kiện xử lý nhờ truyền động con lăn, kiểm soát nhiệt độ, tuần hoàn dung dịch và châm bù hóa chất. Scan và in ảnh nằm ngoài công đoạn tráng.",
]);

const SOURCES = Object.freeze([
  Object.freeze({
    title: "Kodak — Using KODAK FLEXICOLOR Chemicals (Z‑131)",
    url: "https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/z131.pdf",
  }),
  Object.freeze({
    title: "Fujifilm — Process C‑41 technical bulletin",
    url: "https://asset.fujifilm.com/www/cz/files/2020-11/233b5409ee4420f9315b4d991121893b/TB_C41_E01_10-20.pdf",
  }),
]);

// Only finite numbers are accepted; invalid values, including infinities, return 0.
function clampProgress(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;
}

function sampleProcess(value) {
  const progress = clampProgress(value);
  const scaled = progress * STAGES.length;
  const stageIndex = Math.min(STAGES.length - 1, Math.floor(scaled));
  return {
    progress,
    stageIndex,
    stage: STAGES[stageIndex],
    localProgress: scaled - stageIndex,
    safeForLight: stageIndex >= 4,
  };
}

// Fractional indices select the lower integer; invalid indices select the first stage.
function stageProgress(value) {
  const index = typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(STAGES.length - 1, Math.floor(value)))
    : 0;
  return (index + 0.5) / STAGES.length;
}

// src/operational-model.mjs
// Dependency-free, JSON-only teaching model. Time arguments are simulated seconds;
// the UI, not this module, applies timeScale. No photographic density is predicted.
const OPERATION_SPEC = Object.freeze({
  tankCapacityMl: 2000,
  stockCapacityMl: 1000,
  ambientC: 22,
  initialTempC: 22,
  targetC: 37.8,
  toleranceC: 0.15,
  heaterWatts: 400,
  specificHeatJPerKgK: 4180,
  densityKgPerL: 1,
  heatLossWattsPerK: 2,
  minHeaterMl: 1500,
  meteringMlPerSecond: 0.5,
  timeScale: 30,
  maxAdvanceSeconds: 3600,
  maxStepSeconds: 0.5,
  overheatFaultDeltaC: 8,
  assumption: "Bể 2 L, bình bổ sung 1 L, môi trường 22 °C, thanh nhiệt 400 W, nhiệt dung như nước 4.180 J/(kg·K), khối lượng riêng 1 kg/L, thất thoát nhiệt 2 W/K, ngưỡng gia nhiệt 1.500 mL, bơm định lượng 0,5 mL/s và tăng tốc ×30 đều là giả định giáo dục, không phải thông số máy Kodak.",
  thermalModel: "dT/dt = [P − UA(T − T môi trường)]/(m·Cp). Dung dịch bổ sung và nước bù ở 22 °C hòa trộn theo nhiệt dung; bể được coi là trộn đều, không mô phỏng gradient nhiệt hay nhiệt bay hơi. Bộ điều nhiệt ngắt ở mốc đặt. Mỗi lần tiến tối đa 3.600 giây mô phỏng, bước tối đa 0,5 giây.",
  safeguard: "Liên động giáo dục: chỉ gia nhiệt khi bể có ít nhất 1.500 mL và tuần hoàn đang bật. Không khẳng định mọi máy thật có cùng liên động.",
});

// Content shapes: profile.rows = [{id, product, mlPerUnit, unit}]; topics =
// [{id,title,summary,details:string[],caution}]; problems use that same shape
// plus source:{title,url,page,table?}. Objects and all nested arrays are frozen.
const CHEMISTRY_PROFILE = Object.freeze({
  id: "kodak-z131-c41ra-lorr-135-24",
  title: "Mức châm bù khởi điểm C‑41RA · FLEXICOLOR LORR",
  source: Object.freeze({
    title: "Kodak Z‑131 — Using KODAK FLEXICOLOR Chemicals",
    url: "https://business.kodakmoments.com/sites/default/files/wysiwyg/pro/chemistry/z131.pdf",
    page: "4-1",
    table: "4-2",
  }),
  unit: "135-24",
  developerMlPerUnit: 20,
  rows: Object.freeze([
    { id: "developer", product: "FLEXICOLOR Developer Replenisher LORR", mlPerUnit: 20, unit: "135-24" },
    { id: "bleach", product: "FLEXICOLOR RA Bleach Replenisher NR", mlPerUnit: 5, unit: "135-24" },
    { id: "fixer", product: "FLEXICOLOR RA Fixer and Replenisher", mlPerUnit: 35, unit: "135-24" },
    { id: "final-rinse", product: "FLEXICOLOR Final Rinse and Replenisher", mlPerUnit: 40, unit: "135-24" },
  ].map((row) => Object.freeze(row))),
  formula: "Liều thuốc hiện (mL) = số cuộn tương đương 135‑24 × 20 mL/cuộn; thời gian bơm lý tưởng = liều / 0,5 mL/s (tốc độ giả định). Một cuộn tương đương cần 40 giây mô phỏng nếu đủ dung dịch bổ sung.",
  scope: "Z‑131 trang 4‑1, bảng 4‑2: mức khởi điểm cho từng sản phẩm trong cấu hình C‑41RA được nêu, không phải mức chung cho mọi hóa chất C‑41. Ba dòng 5/35/40 mL thuộc các sản phẩm khác, không phải liều thuốc hiện. Không suy ra cuộn 135‑36 theo 36/24; không đổi thành mL/m².",
  startup: "Nạp bể dùng dung dịch làm việc đã pha đúng. Z‑131 trang 1‑2: khi pha bể mới từ Developer Replenisher LORR, dùng Developer Starter LORR tương thích theo hướng dẫn sản phẩm. Starter dùng lúc chuẩn bị bể, không châm sau mỗi cuộn. Replenisher thường dùng starter thường; Developer cho hệ không châm bù ở trang 1‑5 không cần starter. Đây không phải công thức pha.",
  stock: "Bình bổ sung chứa replenisher đã pha sẵn; bể xử lý chứa working solution. Concentrate chưa pha không phải một trong hai dung dịch này. Nạp lại bình bổ sung không tự nạp bể xử lý.",
  reference: "37,8 ± 0,15 °C cho hiện màu theo Z‑131 trang 4‑1, bảng 4‑1; Ready trong mô hình không thay thế control strip hoặc phê duyệt chất lượng quy trình.",
});

const OPERATING_TOPICS = Object.freeze([
  {
    id: "loading", title: "Nạp cassette, nối đầu phim và giữ kín sáng",
    summary: "Chỉ chuẩn bị đoạn leader bỏ đi ngoài ánh sáng; ảnh còn lại vẫn được cassette bảo vệ.",
    details: [
      "Mở nắp để đặt cassette 135 và nối phần đầu phim bỏ đi với thẻ dẫn. Chưa kéo khung ảnh ra khỏi cassette: mở nắp lúc này không đồng nghĩa toàn bộ cuộn bị fog.",
      "Đóng nắp và kiểm tra gioăng/light trap. Chỉ khi bể hiện sẵn sàng, cassette đã đặt và leader đã nối, mô hình mới cho đưa đoạn ảnh nhạy sáng vào đường dẫn bên trong buồng kín.",
      "Một khi phim ảnh đã ra khỏi cassette, mở nắp hoặc làm hở gioăng sẽ đánh dấu cuộn bị lộ sáng. Đóng lại không xóa lỗi; phải bỏ cuộn mô phỏng để chuẩn bị cuộn mới.",
      "Hình cắt lớp là góc nhìn xuyên vỏ để học, không phải máy đang mở dưới ánh sáng. Quy trình lấy đầu phim, nối thẻ và khóa cửa phụ thuộc máy thật.",
    ],
    caution: "Không dùng đèn đỏ cho phim C‑41 còn nhạy sáng. Liên động nạp ở đây là minh họa, không phải cam kết an toàn của mọi máy.",
  },
  {
    id: "heating", title: "Gia nhiệt có tuần hoàn và phản hồi nhiệt độ",
    summary: "Thanh nhiệt đưa bể tới 37,8 °C có kiểm soát, không đun sôi dung dịch.",
    details: [
      "Đầu dò phản hồi nhiệt độ thực của mô hình. Bật tuần hoàn để trộn đều và trao đổi dung dịch tại nhũ tương; bộ lọc giữ vật liệu không tan (Z‑131 trang 2‑2).",
      "Bể 2 L, công suất 400 W và các hằng số truyền nhiệt là giả định công khai. Nhiệt tăng theo năng lượng vào trừ tổn thất ra môi trường; bộ điều nhiệt ngắt khi đạt mốc đặt và bật lại khi nhiệt giảm.",
      "Không cấp nhiệt khi dưới 1.500 mL hoặc bơm tuần hoàn tắt. Yêu cầu bật nhiệt vẫn được nhớ nhưng thanh nhiệt thực sự bị khóa bởi liên động giáo dục.",
      "Mốc tham chiếu hiện màu là 37,8 ± 0,15 °C (Z‑131 trang 4‑1, bảng 4‑1). Nút quá nhiệt tiêm một lỗi nhiệt giả định; sau đó bể nguội theo mô hình, không mô phỏng cháy.",
      "Đồng hồ chạy ×30 để quan sát. Không dùng tốc độ minh họa hay đèn Ready làm thời gian tráng thực; cần nhiệt kế chính xác và control strip (Z‑131 trang 5‑29, Section 5).",
    ],
    caution: "Không thử gia nhiệt khô. Cửa sổ nhiệt độ tham chiếu không tự chứng minh hóa chất đạt chất lượng.",
  },
  {
    id: "fill", title: "Nạp bể mới khác với pha thuốc và châm bù",
    summary: "Bể nhận dung dịch làm việc đã chuẩn bị đúng; bình riêng nhận replenisher đã pha.",
    details: [
      "Concentrate là hóa chất đậm đặc cần pha theo đúng hướng dẫn sản phẩm. Working solution là dung dịch trong bể tiếp xúc phim; replenisher là dung dịch để châm trong khi làm việc.",
      CHEMISTRY_PROFILE.startup,
      "Nút nạp ban đầu chỉ hoạt động khi bể trống và đưa vào 2.000 mL working solution giả định ở 22 °C. Nó không đổ concentrate trực tiếp vào bể và không biến nước thành thuốc hiện.",
      "Bình bổ sung 1.000 mL trong mô hình đã chứa replenisher ở 22 °C. Nạp lại bình không chữa bể bị oxy hóa hay nhiễm chéo; nạp bể cũng không xóa các cờ chất lượng.",
      "Dung dịch đã làm việc ổn định (seasoned) không đồng nghĩa với mọi bể vừa pha; xem Z‑131 trang 1‑2 và 1‑5.",
    ],
    caution: "Không có công thức pha chung ở đây. Kiểm tra đúng SKU, bao bì, SDS và hướng dẫn tương thích hiện hành.",
  },
  {
    id: "replenishment", title: "Châm bù theo lượng phim, không theo vạch mức",
    summary: "Ghi một cuộn tương đương 135‑24 tạo yêu cầu 20 mL; bơm chuyển dần từ bình riêng.",
    details: [
      CHEMISTRY_PROFILE.scope,
      CHEMISTRY_PROFILE.formula,
      "Ghi cuộn nghĩa là giả định cuộn tương đương đã xử lý để học định lượng; thao tác này không tráng phim tức thì và không hoàn thành đường phim sáu công đoạn. Bể trống không được ghi cuộn.",
      "Yêu cầu châm chờ được giữ lại khi bình replenisher hết. Nạp lại bình rồi thời gian chạy tiếp mới giao phần còn thiếu; không tự bỏ nhu cầu chưa giao.",
      "Bể còn chỗ thì giữ dung dịch vừa châm; bể đầy thì lượng dư đi vào bình thu gom. Tổng lượng đã giao bằng lượng bình bổ sung giảm, và bằng phần giữ trong bể cộng phần tràn nếu không có hao hụt khác.",
      "Z‑131 trang 2‑3: mức bổ sung còn phụ thuộc loại phim, độ phơi sáng và hỗn hợp phim. Hiệu chuẩn bơm bằng lượng thực đo, không chỉ tin số cuộn hay tiếng bơm.",
    ],
    caution: "20 mL là mức khởi điểm của Developer Replenisher LORR trong hồ sơ này, không phải mức chung cho mọi bể và mọi cuộn phim.",
  },
  {
    id: "quality", title: "Sự cố hóa học không được chữa bằng đèn Ready",
    summary: "Phân biệt sai nhiệt, bay hơi, oxy hóa, nhiễm chéo và thiếu châm bù.",
    details: [
      "Bay hơi làm mất nước. Nút bù nước chỉ thay lượng bay hơi đã biết và còn chỗ trong bể; không tùy tiện bù cho rò rỉ/carryover hay hóa chất bị tiêu hao (Z‑131 trang 4‑3, 5‑39).",
      "Oxy hóa và nhiễm bleach/fixer vào thuốc hiện là các lỗi cần dừng kiểm tra. Nước hoặc replenisher không được mô hình coi là thuốc chữa; chỉ đặt lại toàn bộ demo mới xóa cờ lỗi.",
      "Z‑131 trang 1‑13, 2‑2 và 2‑12: hạn chế tiếp xúc oxy không cần thiết của thuốc hiện; không khuấy thuốc hiện bằng không khí. Bể bleach lại cần chế độ khuấy/sục khí phù hợp cho khả năng tẩy, không áp dụng cùng quy tắc cho mọi bể.",
      "Đánh giá quy trình thật bằng control strips, đo mật độ và đối chiếu chuẩn (Z‑131 Section 5). Mô hình không dự đoán phần trăm sức khỏe hóa chất, mật độ, cân bằng màu hay tuổi thọ dùng chung.",
      "Đọc SDS, dùng bảo hộ tương thích và thu gom dòng thải theo quy định địa phương. Bình tràn minh họa là bình thu gom, không phải cống; fixer và các dòng chứa bạc cần phương án thu hồi/xử lý phù hợp.",
    ],
    caution: "Ready chỉ là trạng thái bể hiện giáo dục, không phải phê duyệt chất lượng ảnh hoặc hướng dẫn xử lý thải tại cơ sở.",
  },
].map((topic) => Object.freeze({ ...topic, details: Object.freeze(topic.details) })));

const CHEMICAL_PROBLEMS = Object.freeze([
  {
    id: "temperature", title: "Nhiệt độ hiện sai",
    summary: "Quá nóng hoặc quá lạnh đều có thể làm lệch kết quả hiện màu.",
    details: ["Z‑131 trang 5‑29: nhiệt cao làm tăng lượng thuốc nhuộm hình thành, thấp làm giảm; tuần hoàn kém có thể tạo nhiệt không đều.", "Kiểm tra nhiệt kế chính xác, tuần hoàn và điều nhiệt; đối chiếu control strip trước khi cho chạy sản xuất."],
    caution: "Không suy ra mật độ ảnh từ một chỉ số nhiệt trong demo.", page: "5-29",
  },
  {
    id: "contamination", title: "Nhiễm chéo và carryover",
    summary: "Dung dịch kéo theo làm thay đổi bể sau; thuốc hiện đặc biệt cần tránh nhiễm bleach/fixer.",
    details: ["Z‑131 trang 2‑3: carryover tác động nồng độ và pH. Bảo trì con lăn gạt, crossovers và dụng cụ pha riêng.", "Dừng kiểm tra khi có nhiễm chéo; thêm nước hoặc châm replenisher không được coi là khử nhiễm."],
    caution: "Không đổ lẫn các bể hoặc chất tẩy rửa gia dụng.", page: "2-3",
  },
  {
    id: "oxidation", title: "Oxy hóa và ít sử dụng",
    summary: "Để hở và mức sử dụng thấp làm việc quản lý thuốc hiện khó hơn.",
    details: ["Z‑131 trang 1‑13: bình mở làm oxy tiếp xúc hóa chất, nhất là thuốc hiện. Đậy kín và bảo quản đúng hướng dẫn sản phẩm.", "Theo dõi quy trình và hướng dẫn mức sử dụng; không gán hạn dùng chung hoặc phần trăm tuổi thọ từ số giờ trong demo."],
    caution: "Bù nước và replenisher không phục hồi một bể đã oxy hóa trong mô hình.", page: "1-13",
  },
  {
    id: "evaporation", title: "Bay hơi khác tiêu hao hóa chất",
    summary: "Chỉ bù nước cho hao hụt bay hơi đã biết, không cho mọi nguyên nhân hụt mức.",
    details: ["Z‑131 trang 4‑3 và 5‑39: giữ mức dung dịch, phân biệt nước bay hơi với carryover/rò rỉ và tiêu hao hóa chất.", "Demo ghi lượng bay hơi rõ ràng, chỉ bù tối đa lượng đó và khoảng trống còn lại; nước 22 °C cũng làm đổi nhiệt bể theo hòa trộn."],
    caution: "Không coi đầy bể là đúng thành phần, cũng không dùng replenisher tùy tiện thay nước.", page: "4-3; 5-39",
  },
  {
    id: "replenisher", title: "Hết replenisher hoặc bơm lệch định lượng",
    summary: "Có lệnh châm không có nghĩa là đã giao đủ dung dịch.",
    details: ["So sánh liều yêu cầu với lượng đã giao, mức bình và bình thu gom; hiệu chuẩn lưu lượng thực tế.", "Z‑131 trang 4‑1, bảng 4‑2: 20 mL/135‑24 là mức khởi điểm cho Developer Replenisher LORR của hồ sơ C‑41RA này. Demo giữ phần chờ khi bình hết; tốc độ 0,5 mL/s chỉ là giả định."],
    caution: "Không suy ra liều cho 135‑36 hoặc mọi hệ C‑41 từ một dòng bảng.", page: "4-1", table: "4-2",
  },
  {
    id: "bleach-aeration", title: "Thuốc hiện và bleach không cùng quy tắc oxy",
    summary: "Tránh khuấy thuốc hiện bằng không khí; bleach cần chế độ phù hợp để duy trì tẩy bạc.",
    details: ["Z‑131 trang 2‑2, 2‑12 phân biệt khuấy/tuần hoàn thuốc hiện với nhu cầu của bể bleach.", "Theo hướng dẫn đúng hóa chất và thiết kế máy; không khẳng định mọi bleach luôn phải sục khí theo cùng một cấu hình."],
    caution: "Bơm tuần hoàn thuốc hiện trong hình không phải máy sục khí.", page: "2-2; 2-12",
  },
  {
    id: "control-strips", title: "Control strip mới kiểm tra đáp ứng quy trình",
    summary: "Ready không chứng nhận hóa chất hoặc chất lượng ảnh.",
    details: ["Z‑131 Section 5: xử lý control strips, đo mật độ và so với chuẩn theo đúng quy trình kiểm soát.", "Demo chỉ biết nhiệt, mức, tuần hoàn và các lỗi đã khai báo; không biết hoạt tính hóa học, màu hay tương phản của ảnh thật."],
    caution: "Không bỏ kiểm soát chất lượng vì mô hình đang báo sẵn sàng.", page: "Section 5",
  },
  {
    id: "waste-sds", title: "SDS, bảo hộ và thu gom thải",
    summary: "Bình tràn thu gom dung dịch, không đại diện đường xả sinh hoạt.",
    details: ["Z‑131 trang 1‑6 đến 1‑9, 1‑12: đọc SDS/nhãn, dùng kính chống văng, găng tương thích, tạp dề và thông gió thích hợp.", "Thu gom hóa chất và dòng thải chứa bạc, đặc biệt fixer, theo quy định địa phương và phương án thu hồi/xử lý; không giả định các dòng chứa lượng bạc như nhau."],
    caution: "Không có công thức pha, thiết kế thông gió chung hay hiệu suất thu hồi bạc được suy đoán ở đây.", page: "1-6–1-9; 1-12; phần xử lý thải",
  },
].map(({ page, table, ...problem }) => Object.freeze({
  ...problem,
  details: Object.freeze(problem.details),
  source: Object.freeze({ ...CHEMISTRY_PROFILE.source, page, table: table || "" }),
})));

function createOperationState() {
  return {
    tankMl: 0, stockMl: OPERATION_SPEC.stockCapacityMl, wasteMl: 0,
    tempC: OPERATION_SPEC.initialTempC,
    pumpOn: false, heatRequested: false, heaterOn: false,
    lidClosed: false, sealIntact: true,
    cassetteLoaded: false, leaderAttached: false, filmInGate: false, filmFogged: false,
    pendingDoseMl: 0, totalDosedMl: 0, rollsRecorded: 0, evaporatedMl: 0,
    oxidized: false, contaminated: false, simSeconds: 0,
    lastEvent: "Bể trống; bình riêng có replenisher đã pha sẵn. Nạp dung dịch làm việc trước khi bật tuần hoàn và gia nhiệt.",
  };
}

// Fractional counts are equivalent 135-24 rolls, not inferred film-format conversion.
// Overflowing products and nonnumeric/negative inputs yield 0; -0 is canonicalized.
function doseForRolls(count) {
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return 0;
  const dose = count * CHEMISTRY_PROFILE.developerMlPerUnit;
  return Number.isFinite(dose) ? dose : 0;
}

function applyOperation(state, action) {
  // Malformed state is treated as a fresh demo, not partially trusted hardware data.
  const initial = createOperationState();
  const validState = state && typeof state === "object" && !Array.isArray(state)
    && Object.entries(initial).every(([key, value]) => typeof state[key] === typeof value
      && (typeof value !== "number" || Number.isFinite(state[key])
        && (key === "tempC" ? state[key] >= -50 && state[key] <= 100 : state[key] >= 0)))
    && state.tankMl <= OPERATION_SPEC.tankCapacityMl
    && state.stockMl <= OPERATION_SPEC.stockCapacityMl;
  const next = validState
    ? Object.fromEntries(Object.keys(initial).map((key) => [key, state[key]]))
    : initial;
  const finish = () => {
    next.heaterOn = next.heatRequested && next.pumpOn
      && next.tankMl >= OPERATION_SPEC.minHeaterMl && next.tempC < OPERATION_SPEC.targetC;
    return next;
  };
  const reject = (message) => { next.lastEvent = message; return finish(); };
  if (!action || typeof action !== "object" || Array.isArray(action)) return finish();
  switch (action.type) {
    case "reset": return createOperationState();
    case "fillTank":
      if (next.tankMl > 0) return reject("Chỉ nạp ban đầu khi bể trống; đây không phải nút châm bù hoặc thêm concentrate.");
      next.tankMl = OPERATION_SPEC.tankCapacityMl;
      next.tempC = OPERATION_SPEC.initialTempC;
      next.evaporatedMl = 0;
      next.lastEvent = "Đã nạp 2.000 mL dung dịch làm việc pha đúng ở 22 °C; không xóa lỗi oxy hóa/nhiễm chéo đã khai báo.";
      break;
    case "refillStock":
      next.stockMl = OPERATION_SPEC.stockCapacityMl;
      next.lastEvent = "Bình bổ sung đã nạp đầy replenisher pha sẵn ở 22 °C. Phần liều đang chờ vẫn được giữ; bể xử lý chưa được châm ngay.";
      break;
    case "setPump":
      if (typeof action.on !== "boolean") return finish();
      next.pumpOn = action.on;
      next.lastEvent = action.on ? "Đã bật tuần hoàn/lọc minh họa; đây không phải sục khí thuốc hiện." : "Đã tắt tuần hoàn; liên động giáo dục ngắt thanh nhiệt.";
      break;
    case "setHeater":
      if (typeof action.on !== "boolean") return finish();
      next.heatRequested = action.on;
      next.lastEvent = !action.on ? "Đã tắt yêu cầu gia nhiệt; bể trao đổi nhiệt tự nhiên với môi trường."
        : next.tankMl < OPERATION_SPEC.minHeaterMl || !next.pumpOn
          ? "Đã yêu cầu nhiệt nhưng bị liên động giáo dục chặn: cần ít nhất 1.500 mL và tuần hoàn bật."
          : "Đã yêu cầu gia nhiệt; bộ điều nhiệt tự ngắt ở 37,8 °C.";
      break;
    case "setLid":
      if (typeof action.closed !== "boolean") return finish();
      next.lidClosed = action.closed;
      if (!action.closed && next.filmInGate) next.filmFogged = true;
      next.lastEvent = !action.closed && next.filmInGate
        ? "Đã mở nắp khi ảnh nhạy sáng ở ngoài cassette: cuộn demo bị lộ sáng; đóng lại không sửa được."
        : action.closed ? "Nắp đã đóng; vẫn cần gioăng nguyên vẹn. Đóng nắp không phục hồi phim đã lộ sáng."
          : "Nắp mở để chuẩn bị cassette/leader; các khung ảnh còn trong cassette vẫn được bảo vệ.";
      break;
    case "setSeal":
      if (typeof action.intact !== "boolean") return finish();
      next.sealIntact = action.intact;
      if (!action.intact && next.filmInGate) next.filmFogged = true;
      next.lastEvent = !action.intact && next.filmInGate
        ? "Gioăng bị hở khi phim ảnh ở ngoài cassette: cuộn demo đã lộ sáng vĩnh viễn trong lượt này."
        : action.intact ? "Gioăng được khôi phục; không xóa lộ sáng đã xảy ra." : "Gioăng đang hở; không được đưa phim ảnh ra khỏi cassette.";
      break;
    case "loadCassette":
      if (next.lidClosed) return reject("Mở nắp để đặt cassette; không kéo đoạn ảnh ra ánh sáng.");
      if (next.filmInGate || next.filmFogged) return reject("Bỏ cuộn demo hiện tại trước khi chuẩn bị cassette mới.");
      next.cassetteLoaded = true;
      next.lastEvent = "Cassette đã đặt; các khung ảnh vẫn nằm trong vỏ, chưa bị lộ sáng dù nắp đang mở.";
      break;
    case "attachLeader":
      if (!next.cassetteLoaded) return reject("Đặt cassette trước khi nối leader bỏ đi với thẻ dẫn.");
      if (next.lidClosed || next.filmInGate) return reject("Chỉ nối leader khi nắp mở và chưa kéo khung ảnh vào đường dẫn.");
      next.leaderAttached = true;
      next.lastEvent = "Đã nối phần leader bỏ đi; chưa đưa khung ảnh ra khỏi cassette, nên ảnh bên trong vẫn được bảo vệ.";
      break;
    case "feedFilm": {
      const status = operationStatus(next);
      if (!status.canFeed) return reject(`Chưa thể đưa phim: ${status.blockedReason}`);
      next.filmInGate = true;
      next.lastEvent = "Đoạn ảnh nhạy sáng đã ra khỏi cassette bên trong buồng kín. Không mở nắp hoặc làm hở gioăng; chưa có khẳng định đã tráng xong.";
      break;
    }
    case "discardFilm":
      next.cassetteLoaded = false;
      next.leaderAttached = false;
      next.filmInGate = false;
      next.filmFogged = false;
      next.lastEvent = "Đã bỏ cuộn demo và xóa trạng thái lộ sáng của cuộn đó; chuẩn bị cassette mới. Không thay đổi tình trạng hóa chất.";
      break;
    case "recordRoll":
      if (next.tankMl <= 0) return reject("Bể hiện đang trống: không ghi cuộn hoặc xếp liều châm vào một bể không có dung dịch.");
      if (next.pendingDoseMl > Number.MAX_SAFE_INTEGER - 20 || next.rollsRecorded >= Number.MAX_SAFE_INTEGER) return reject("Số liệu demo đã đạt giới hạn; đặt lại demo để tiếp tục.");
      next.rollsRecorded += 1;
      next.pendingDoseMl += doseForRolls(1);
      next.lastEvent = "Giả định một cuộn tương đương 135‑24 đã xử lý: xếp thêm 20 mL LORR theo Z‑131 bảng 4‑2, chưa giao ngay. Đây không phải tráng phim tức thì.";
      break;
    case "evaporate": {
      if (typeof action.ml !== "number" || !Number.isFinite(action.ml) || action.ml <= 0) return finish();
      const loss = Math.min(action.ml, next.tankMl);
      next.tankMl -= loss;
      next.evaporatedMl += loss;
      if (next.tankMl === 0) next.tempC = OPERATION_SPEC.ambientC;
      next.lastEvent = `Kịch bản bay hơi đã lấy ${loss} mL nước khỏi bể; ghi nhận riêng, không coi đó là hóa chất đã tiêu hao hoặc bơm châm bù.`;
      break;
    }
    case "topUpWater": {
      const added = Math.min(next.evaporatedMl, OPERATION_SPEC.tankCapacityMl - next.tankMl);
      if (added <= 0) return reject("Không có hao hụt bay hơi đã biết hoặc bể không còn chỗ: không tự thêm nước.");
      next.tempC = (next.tankMl * next.tempC + added * OPERATION_SPEC.ambientC) / (next.tankMl + added);
      next.tankMl += added;
      next.evaporatedMl -= added;
      next.lastEvent = `Đã bù ${added} mL nước ở 22 °C cho bay hơi đã biết; không chữa oxy hóa, nhiễm chéo hoặc thay replenisher.`;
      break;
    }
    case "oxidize":
      next.oxidized = true;
      next.lastEvent = "Đã khai báo thuốc hiện oxy hóa: dừng để kiểm tra. Bù nước/châm bù không xóa lỗi; chỉ đặt lại demo mới xóa cờ này.";
      break;
    case "contaminate":
      next.contaminated = true;
      next.lastEvent = "Đã khai báo nhiễm chéo thuốc hiện: dừng để kiểm tra, không giả lập chữa bằng nước hoặc replenisher.";
      break;
    case "overheat": {
      if (next.tankMl <= 0) return reject("Bể trống: không tiêm kịch bản nhiệt độ dung dịch.");
      const before = next.tempC;
      next.tempC = Math.min(80, Math.max(next.tempC, OPERATION_SPEC.targetC) + OPERATION_SPEC.overheatFaultDeltaC);
      next.lastEvent = `Tiêm lỗi nhiệt giáo dục: tăng từ ${before.toFixed(1)} lên ${next.tempC.toFixed(1)} °C (ít nhất mốc 37,8 + 8 °C, trần demo 80 °C). Bộ điều nhiệt ngắt, bể sẽ nguội; không mô phỏng cháy.`;
      break;
    }
    default: break;
  }
  return finish();
}

function operationStatus(state) {
  const current = applyOperation(state, null);
  const issues = [];
  const add = (id, title, detail) => issues.push({ id, title, detail });
  if (current.tankMl === 0) add("empty-tank", "Bể hiện trống", "Nạp dung dịch làm việc đã pha đúng; nước không thay thế thuốc hiện.");
  else if (current.tankMl < OPERATION_SPEC.minHeaterMl) add("low-level", "Mức bể dưới ngưỡng", "Cần ít nhất 1.500 mL cho liên động gia nhiệt giáo dục; kiểm tra nguyên nhân thiếu mức.");
  if (!current.pumpOn) add("circulation-off", "Tuần hoàn đang tắt", "Bật bơm tuần hoàn/lọc để trộn đều và cho phép gia nhiệt.");
  if (Math.abs(current.tempC - OPERATION_SPEC.targetC) > OPERATION_SPEC.toleranceC + 1e-10) add("temperature", "Nhiệt độ ngoài mốc tham chiếu", "Đưa bể về 37,8 ± 0,15 °C; xác minh bằng nhiệt kế và control strip khi vận hành thật.");
  if (current.oxidized) add("oxidized", "Đã khai báo oxy hóa", "Dừng kiểm tra hóa chất. Nước hoặc replenisher không xóa lỗi; chỉ đặt lại demo xóa cờ.");
  if (current.contaminated) add("contaminated", "Đã khai báo nhiễm chéo", "Dừng kiểm tra bể hiện. Không coi thêm nước/châm bù là khử nhiễm.");
  const ready = issues.length === 0;
  if (!current.cassetteLoaded) add("no-cassette", "Chưa có cassette", "Mở nắp và đặt cassette; chưa cần bể sẵn sàng để chuẩn bị cuộn.");
  if (!current.leaderAttached) add("no-leader", "Chưa nối leader", "Nối phần đầu bỏ đi, không kéo khung ảnh ra ngoài ánh sáng.");
  if (!current.lidClosed) add("lid-open", "Nắp đang mở", "Đóng nắp trước khi đưa đoạn ảnh nhạy sáng ra khỏi cassette.");
  if (!current.sealIntact) add("seal-leak", "Gioăng đang hở", "Khôi phục kín sáng trước khi kéo phim; không sửa được phim đã lộ sáng.");
  if (current.filmFogged) add("fogged-film", "Cuộn demo đã lộ sáng", "Bỏ cuộn demo để chuẩn bị cuộn mới; đóng nắp không khôi phục ảnh.");
  if (current.filmInGate) add("film-in-gate", "Phim đã ở trong đường dẫn", "Giữ buồng kín sáng; demo chưa mô phỏng hoàn tất định hình. Bỏ cuộn trước khi chuẩn bị lượt mới.");
  return {
    ready,
    canFeed: ready && issues.length === 0,
    heaterAllowed: current.pumpOn && current.tankMl >= OPERATION_SPEC.minHeaterMl,
    blockedReason: issues.length ? issues[0].detail : "",
    issues,
    safeToOpen: !current.filmInGate,
  };
}

function advanceOperation(state, simulatedSeconds) {
  const next = applyOperation(state, null);
  if (typeof simulatedSeconds !== "number" || !Number.isFinite(simulatedSeconds) || simulatedSeconds <= 0) return next;
  const duration = Math.min(simulatedSeconds, OPERATION_SPEC.maxAdvanceSeconds);
  const steps = Math.ceil(duration / OPERATION_SPEC.maxStepSeconds);
  const dt = duration / steps;
  const startedStock = next.stockMl;
  const startedPending = next.pendingDoseMl;
  for (let step = 0; step < steps; step += 1) {
    // This separate metering pump does not depend on the circulation switch.
    // Do not deliver into a nonexistent bath; keep demand for a later fill.
    const delivered = next.tankMl > 0
      ? Math.min(next.pendingDoseMl, next.stockMl, OPERATION_SPEC.meteringMlPerSecond * dt) : 0;
    if (delivered > 0) {
      const mixedMl = next.tankMl + delivered;
      next.tempC = (next.tankMl * next.tempC + delivered * OPERATION_SPEC.ambientC) / mixedMl;
      next.tankMl = Math.min(mixedMl, OPERATION_SPEC.tankCapacityMl);
      next.wasteMl += Math.max(0, mixedMl - OPERATION_SPEC.tankCapacityMl);
      next.stockMl -= delivered;
      next.pendingDoseMl -= delivered;
      next.totalDosedMl += delivered;
    }
    if (next.tankMl > 0) {
      const heating = next.heatRequested && next.pumpOn
        && next.tankMl >= OPERATION_SPEC.minHeaterMl && next.tempC < OPERATION_SPEC.targetC;
      const massKg = next.tankMl / 1000 * OPERATION_SPEC.densityKgPerL;
      const equilibriumC = OPERATION_SPEC.ambientC + (heating ? OPERATION_SPEC.heaterWatts / OPERATION_SPEC.heatLossWattsPerK : 0);
      const factor = Math.exp(-OPERATION_SPEC.heatLossWattsPerK * dt / (massKg * OPERATION_SPEC.specificHeatJPerKgK));
      const evolved = equilibriumC + (next.tempC - equilibriumC) * factor;
      // Ideal thermostat cuts power at target, never invents extra heat above it.
      next.tempC = heating ? Math.min(OPERATION_SPEC.targetC, evolved) : evolved;
    }
  }
  next.simSeconds = Math.min(Number.MAX_SAFE_INTEGER, next.simSeconds + duration);
  if (startedStock > 0 && next.stockMl === 0 && next.pendingDoseMl > 0) next.lastEvent = "Bình replenisher đã hết; phần liều chưa giao vẫn đang chờ. Nạp lại bình đã pha đúng để tiếp tục.";
  else if (startedPending > 0 && next.pendingDoseMl === 0) next.lastEvent = "Đã giao đủ liều chờ bằng bơm định lượng. Phần tràn được thu gom; châm bù không chứng nhận chất lượng bể.";
  else if (next.pendingDoseMl > 0 && next.tankMl === 0) next.lastEvent = "Bể đang trống: bơm định lượng dừng và giữ nguyên liều chờ.";
  return applyOperation(next, null);
}

// src/figure-runtime.mjs

// Six-stage instructional path preview drawn on the single machine. This closure owns the progress target,
// the eased artwork and the film ribbon; the unified controller owns the frame loop, the camera and the
// visibility/reduced-motion policy. Seeking here is a path preview, never proof that film was processed.
function createProcessTour(ctx) {
  const { data, root: stageRoot, region, still, isActive, wake } = ctx;
  const $ = (selector) => ctx.uiRoot.querySelector(selector);
  const progressInput = $('#progress');
  const playButton = $('#play');
  const restartButton = $('#restart');
  const stageButtons = [...ctx.uiRoot.querySelectorAll('[data-select-stage]')];
  const nodes = data.chunks.map((chunk, index) => {
    const root = stageRoot.querySelector(`[data-film="${index}"]`);
    // Chunks inside the loading box double as the operated leader and gate film: they keep a frozen surface
    // and never carry the tracked preview marker, so preview motion never reads as real transport.
    return { ...chunk, loaded: root.hasAttribute('data-op-film'), holes: root.querySelector('.film-holes'), frames: root.querySelector('.film-frames'), mark: root.querySelector('.film-mark'), edgeMark: root.querySelector('.film-edge-mark') };
  });
  const previewChunks = nodes.filter((chunk) => !chunk.loaded);
  const rollers = data.rollers.map((roller, index) => ({ ...roller, node: stageRoot.querySelector(`[data-roller="${index}"]`) }));
  const text = {
    title: $('#stage-title'), english: $('#stage-english'), description: $('#stage-description'),
    film: $('#film-state'), note: $('#stage-note'), metric: $('#metric-value'), metricLabel: $('#metric-label'),
    readout: $('[data-readout]'), number: $('#stage-number'), percent: $('#progress-value'), light: $('#light-status'),
    tour: $('#tour-state'),
  };

  const PLAY_LABELS = { running: 'Tạm dừng', held: 'Tiếp tục xem trước', stopped: 'Phát xem trước', still: 'Chế độ tĩnh' };
  let current = 0;
  let target = 0;
  let wantedPlaying = !still.matches;
  let explicitResume = false;
  let hover = false;
  let focused = false;
  let dragging = false;
  let moving = false;
  let quietUntil = performance.now() + 1400;
  let resumeTimer = 0;
  let lastPhase = -1;
  let announceTimer = 0;
  let announcementPending = false;
  let lastHoleOffset = -Infinity;

  function pathRect(chunk, a0, a1, y0, y1) {
    const at = (a, y) => {
      const x = chunk.o[0] + chunk.ea[0] * (a - chunk.a0) + chunk.ey[0] * y;
      const z = chunk.o[1] + chunk.ea[1] * (a - chunk.a0) + chunk.ey[1] * y;
      return `${x.toFixed(2)} ${z.toFixed(2)}`;
    };
    return `M${at(a0, y0)}L${at(a1, y0)}L${at(a1, y1)}L${at(a0, y1)}Z`;
  }
  function distanceAt(progress) {
    const sample = sampleProcess(progress);
    const from = data.bounds[sample.stageIndex];
    const to = data.bounds[sample.stageIndex + 1];
    return from + (to - from) * sample.localProgress;
  }
  function drawChunk(chunk, distance, tracked) {
    const f = data.film;
    let holes = '';
    let frames = '';
    const first = Math.floor((chunk.a0 - distance) / f.pitch);
    const lastHole = Math.ceil((chunk.a1 - distance) / f.pitch);
    for (let i = first; i <= lastHole; i++) {
      const start = Math.max(chunk.a0, distance + i * f.pitch);
      const end = Math.min(chunk.a1, distance + i * f.pitch + f.hole[0]);
      if (end <= start) continue;
      for (const y of [f.holeRow - f.hole[1] / 2, f.width - f.holeRow - f.hole[1] / 2]) holes += pathRect(chunk, start, end, y, y + f.hole[1]);
    }
    if (chunk.dev) {
      const firstFrame = Math.floor((chunk.a0 - distance) / f.frame);
      const lastFrame = Math.ceil((chunk.a1 - distance) / f.frame);
      for (let i = firstFrame; i <= lastFrame; i++) {
        const start = Math.max(chunk.a0, distance + i * f.frame + f.gap);
        const end = Math.min(chunk.a1, distance + (i + 1) * f.frame - f.gap);
        if (end > start) frames += pathRect(chunk, start, end, f.frameInset, f.width - f.frameInset);
      }
    }
    const markerFrom = tracked ? Math.max(chunk.a0, distance - 8) : 0;
    const markerTo = tracked ? Math.min(chunk.a1, distance + 8) : 0;
    chunk.holes.setAttribute('d', holes);
    chunk.frames.setAttribute('d', frames);
    chunk.mark.setAttribute('d', markerTo > markerFrom ? pathRect(chunk, markerFrom, markerTo, f.frameInset, f.width - f.frameInset) : '');
    // The tracked frame's index printed on the ribbon's front edge, visible at each U's underside.
    const edgeAt = (position) => `${(chunk.edgeO[0] + chunk.edgeE[0] * (position - chunk.a0)).toFixed(2)} ${(chunk.edgeO[1] + chunk.edgeE[1] * (position - chunk.a0)).toFixed(2)}`;
    chunk.edgeMark.setAttribute('d', markerTo > markerFrom ? `M${edgeAt(markerFrom)}L${edgeAt(markerTo)}` : '');
  }
  for (const chunk of nodes) if (chunk.loaded) drawChunk(chunk, 0, false);
  function drawFilm(distance) {
    for (const chunk of previewChunks) drawChunk(chunk, distance, true);
    for (const roller of rollers) {
      const a = distance * roller.spin;
      const u = Math.cos(a) * roller.rho;
      const v = Math.sin(a) * roller.rho;
      roller.node.setAttribute('cx', (roller.c[0] + roller.ex[0] * u + roller.ez[0] * v).toFixed(2));
      roller.node.setAttribute('cy', (roller.c[1] + roller.ex[1] * u + roller.ez[1] * v).toFixed(2));
    }
    lastHoleOffset = distance;
  }
  function announce() {
    const sample = sampleProcess(current);
    ctx.announce(`Xem trước đường đi, ${sample.stageIndex + 1} trên ${STAGES.length}. ${sample.stage.title}. ${sample.stage.filmState}.`);
    announcementPending = false;
  }
  function describe() {
    const sample = sampleProcess(target);
    progressInput.setAttribute('aria-valuetext', `${Math.round(target * 100)} phần trăm hành trình xem trước. ${sample.stage.title}. ${sample.stage.filmState}.`);
  }
  function draw() {
    const sample = sampleProcess(current);
    const distance = distanceAt(current);
    ctx.uiRoot.dataset.stage = sample.stage.id;
    stageRoot.dataset.progress = current.toFixed(5);
    stageRoot.dataset.distance = distance.toFixed(2);
    text.percent.value = `${Math.round(target * 100)}%`;
    // The native control stays at the requested position; only the artwork eases.
    progressInput.value = String(Math.round(target * 1000));
    progressInput.style.setProperty('--progress', `${target * 100}%`);
    text.readout.textContent = `Xem trước ${String(sample.stageIndex + 1).padStart(2, '0')} / 06 · ${sample.stage.title}`;
    if (Math.abs(distance - lastHoleOffset) > 0.04 || still.matches) drawFilm(distance);
    if (sample.stageIndex !== lastPhase) {
      const stage = sample.stage;
      for (const name of ['title', 'english', 'description', 'note']) text[name].textContent = stage[name];
      text.film.textContent = stage.filmState;
      text.metric.textContent = stage.metric.value;
      text.metricLabel.textContent = stage.metric.label;
      text.number.textContent = String(stage.index + 1).padStart(2, '0');
      text.light.textContent = sample.safeForLight ? 'Xem trước: đã định hình · có thể ra sáng' : 'Xem trước: phải tiếp tục kín sáng';
      text.light.dataset.safe = String(sample.safeForLight);
      stageButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === sample.stageIndex)));
      lastPhase = sample.stageIndex;
    }
    syncPlay();
  }
  function canTour() {
    return ctx.interactive() && wantedPlaying && !still.matches && ctx.cameraWhole() && (!hover || explicitResume) && (!focused || explicitResume) && !dragging && performance.now() >= quietUntil;
  }
  // 'running': the tour advances (or would, once on screen). 'held': wanted, but paused for inspection,
  // a recent seek or a close-up; pressing the button resumes it at once. 'stopped' and 'still' are explicit.
  function playMode() {
    if (still.matches) return 'still';
    if (!wantedPlaying) return 'stopped';
    return canTour() ? 'running' : 'held';
  }
  function syncPlay() {
    const running = canTour() && isActive();
    const mode = playMode();
    // The accessible name stays "Tự phát xem trước"; aria-pressed says whether it is advancing.
    playButton.setAttribute('aria-pressed', String(mode === 'running'));
    playButton.disabled = still.matches;
    playButton.querySelector('[data-play-text]').textContent = PLAY_LABELS[mode];
    playButton.dataset.playing = String(mode === 'running');
    playButton.dataset.mode = mode;
    stageRoot.dataset.running = String(running);
    text.tour.textContent = mode === 'still' ? 'Giảm chuyển động đang bật'
      : mode === 'stopped' ? 'Xem trước đã dừng'
        : mode === 'held' ? (ctx.cameraWhole() ? 'Tour tạm giữ khi bạn xem hoặc chọn vị trí · bấm Tiếp tục để chạy ngay' : 'Đang xem cận cảnh · tour tạm giữ, Tiếp tục sẽ về toàn máy')
          : running ? 'Đang xem trước đường phim' : 'Tour chờ máy vào khung nhìn';
  }
  function scheduleResume() {
    clearTimeout(resumeTimer);
    if (!ctx.interactive() || !isActive() || !wantedPlaying || still.matches || !ctx.cameraWhole() || (hover && !explicitResume) || (focused && !explicitResume) || dragging) return;
    resumeTimer = setTimeout(wake, Math.max(0, quietUntil - performance.now()) + 20);
  }
  // One step of the shared frame loop. Returns true while the tour or the eased artwork still moves.
  function step(dt) {
    if (still.matches) return false;
    const touring = canTour();
    if (!touring && current === target && !moving) return false;
    const t = Math.min(dt, 1 / 30);
    if (touring) {
      if (current >= 1 - 0.000001) wantedPlaying = false; // End on the dry negative; restart is explicit.
      else target = clampProgress(target + t / 48);
    }
    current += (target - current) * (1 - Math.exp(-t / 0.16));
    if (Math.abs(current - target) < 0.00005) current = target;
    draw();
    if (current === target && announcementPending) { describe(); announce(); }
    moving = canTour() || current !== target;
    if (!moving) scheduleResume();
    return moving;
  }
  function seek(next, { announceChange = true, chosen = true } = {}) {
    if (!ctx.interactive()) return;
    const before = sampleProcess(target).stageIndex;
    target = clampProgress(next);
    describe();
    explicitResume = false;
    quietUntil = performance.now() + 3600;
    clearTimeout(announceTimer);
    announcementPending = announceChange;
    if (chosen && sampleProcess(target).stageIndex !== before) ctx.onStageChosen(sampleProcess(target).stageIndex);
    if (still.matches || !isActive()) {
      current = target;
      draw();
      if (announceChange) announce();
    } else {
      moving = true;
      wake();
    }
    scheduleResume();
  }
  // Acts on the state the reader saw: a pointer press records it before focus moves into the region.
  function togglePlay(seen = playButton.dataset.mode) {
    if (still.matches) return;
    if (!ctx.interactive()) return;
    wantedPlaying = seen !== 'running';
    explicitResume = wantedPlaying;
    if (!wantedPlaying) target = current; // A pause freezes the visible position, including an eased seek.
    if (wantedPlaying) ctx.beforePlay();
    if (wantedPlaying && current >= 1) { current = 0; target = 0; draw(); }
    quietUntil = performance.now();
    describe();
    syncPlay();
    wake();
    scheduleResume();
  }
  // The displayed (and announced) mode decides, not a policy change the reader has not seen yet.
  let pressedMode = null;
  playButton.addEventListener('pointerdown', () => { pressedMode = playButton.dataset.mode; });
  playButton.addEventListener('click', (event) => {
    const seen = event.detail > 0 && pressedMode ? pressedMode : playButton.dataset.mode;
    pressedMode = null;
    togglePlay(seen);
  });
  restartButton.addEventListener('click', () => seek(0));
  stageButtons.forEach((button, index) => button.addEventListener('click', () => seek(stageProgress(index))));
  progressInput.addEventListener('input', () => seek(Number(progressInput.value) / 1000, { announceChange: false }));
  progressInput.addEventListener('change', () => {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { announcementPending = true; if (current === target) announce(); }, still.matches ? 0 : 250);
  });
  progressInput.addEventListener('focus', describe);
  function keyboard(event) {
    if (event.target === progressInput || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape' && event.target === stageRoot) { event.preventDefault(); ctx.onEscape(); return; }
    // Reader mode is a view of the machine: keys may reset the camera but never move the film preview.
    if (!ctx.interactive()) return;
    // Rapid presses step from the requested stage, not from the artwork still easing towards it.
    const here = sampleProcess(target).stageIndex;
    let next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = stageProgress(Math.min(5, here + 1));
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = stageProgress(Math.max(0, here - 1));
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = 1;
    if (event.key === ' ' && event.target === stageRoot) { event.preventDefault(); togglePlay(); return; }
    if (next === null) return;
    event.preventDefault();
    seek(next);
  }
  stageRoot.addEventListener('keydown', keyboard);
  $('.stage-nav').addEventListener('keydown', keyboard);

  // Dragging across the card previews the path under the pointer. When magnified, the same mapping runs
  // through the visible frame, so a drag moves through the region in view. It never moves the camera.
  function pointerSeek(event) {
    const box = stageRoot.getBoundingClientRect();
    const whole = ctx.pointerFraction((event.clientX - box.left) / box.width);
    seek((whole - 0.08) / 0.84, { announceChange: false, chosen: false });
  }
  stageRoot.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') { hover = true; explicitResume = false; syncPlay(); }
  });
  stageRoot.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') { hover = false; quietUntil = performance.now() + 3600; scheduleResume(); }
  });
  // Mouse: the press itself seeks, as before. Touch and pen: nothing changes until the finger clearly
  // travels sideways (then it is a drag) or lifts without travelling (then it is a tap). A vertical swipe is
  // left to the page scroll, and a cancelled gesture restores what the reader had before it began.
  const GESTURE_SLOP = 10; // CSS px
  let gesture = null;
  function beginDrag(event) {
    gesture.live = true;
    dragging = true;
    // Only a real, active pointer can be captured; synthetic events simply drag without capture.
    if (event.isTrusted) stageRoot.setPointerCapture(event.pointerId);
    pointerSeek(event);
  }
  function endGesture(event, kind) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const { live, x, y, saved } = gesture;
    gesture = null;
    const tap = kind === 'up' && !live && Math.hypot(event.clientX - x, event.clientY - y) <= GESTURE_SLOP;
    if (!live && !tap) return; // a scroll or an ambiguous touch: progress, tour and announcements untouched
    dragging = false;
    if (stageRoot.hasPointerCapture(event.pointerId)) stageRoot.releasePointerCapture(event.pointerId);
    if (kind === 'cancel') {
      clearTimeout(announceTimer);
      announcementPending = false;
      ({ target, explicitResume, quietUntil } = saved);
      describe();
      if (still.matches || !isActive()) { current = target; draw(); } else { moving = true; wake(); }
      scheduleResume();
      return;
    }
    if (tap) pointerSeek(event);
    announcementPending = true;
    if (still.matches || current === target) announce();
    quietUntil = performance.now() + 3600;
    scheduleResume();
  }
  stageRoot.addEventListener('pointerdown', (event) => {
    if (!ctx.interactive() || !event.isPrimary || event.button !== 0) return;
    if (gesture?.live) dragging = false; // a press never ended by the platform is superseded, not stuck
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, live: false, saved: { target, explicitResume, quietUntil } };
    if (event.pointerType === 'mouse') beginDrag(event);
  });
  stageRoot.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (gesture.live) { pointerSeek(event); return; }
    const dx = Math.abs(event.clientX - gesture.x);
    const dy = Math.abs(event.clientY - gesture.y);
    if (dy > GESTURE_SLOP && dy >= dx) gesture = null; // vertical: the page scrolls, the tour is untouched
    else if (dx > GESTURE_SLOP && dx > dy * 1.5) beginDrag(event);
  });
  stageRoot.addEventListener('pointerup', (event) => endGesture(event, 'up'));
  stageRoot.addEventListener('pointercancel', (event) => endGesture(event, 'cancel'));
  // Touch starts with implicit capture on the SVG child. Its bubbled loss during transfer to this
  // root is not the end of our drag; only losing the root's own capture ends the gesture.
  stageRoot.addEventListener('lostpointercapture', (event) => { if (event.target === stageRoot) endGesture(event, 'lost'); });
  region.addEventListener('focusin', () => { focused = true; explicitResume = false; syncPlay(); });
  region.addEventListener('focusout', (event) => {
    if (!region.contains(event.relatedTarget)) {
      focused = false;
      quietUntil = performance.now() + 3600;
      scheduleResume();
    }
  });

  return {
    snapshot: () => ({ current, target }),
    step,
    seek,
    start() { draw(); describe(); scheduleResume(); },
    // A magnified region is an inspection state: the idle tour waits for the whole-machine view and
    // re-arms (after the usual quiet period) once the camera returns to it.
    cameraChanged() { quietUntil = Math.max(quietUntil, performance.now() + 3600); scheduleResume(); syncPlay(); },
    onActiveChange() {
      if (!isActive()) clearTimeout(resumeTimer);
      else scheduleResume();
      syncPlay();
    },
    onReducedChange() {
      clearTimeout(resumeTimer);
      if (still.matches) { wantedPlaying = false; current = target; moving = false; }
      draw();
      describe();
      scheduleResume();
    },
  };
}

// src/operation-runtime.mjs

// The developer bath, loading box, pump, metering and overflow parts of the single machine, driven by one
// authoritative operation state. Scene parts are read from the one scene SVG; controls and readouts from
// the console. The unified controller owns the frame loop and decides when model time may advance.
const STEP_SECONDS = 30;
const MAX_FRAME = 0.1; // real seconds; a stalled tab never catches up hidden time
const ACCENTS = Object.freeze({
  loading: ['seal'],
  heating: ['heater', 'probe', 'circulation'],
  fill: ['solution', 'stock'],
  replenishment: ['dose', 'stock', 'overflow', 'waste'],
  quality: ['solution', 'overflow', 'waste'],
});
const TOGGLES = Object.freeze({
  lidOpen: (s) => !s.lidClosed, lidClosed: (s) => s.lidClosed,
  sealBroken: (s) => !s.sealIntact, sealIntact: (s) => s.sealIntact,
  pumpOn: (s) => s.pumpOn, pumpOff: (s) => !s.pumpOn,
  heatOn: (s) => s.heatRequested, heatOff: (s) => !s.heatRequested,
});

function createOperationConsole(ctx) {
  const { data, scene, panel, reduced, isTicking } = ctx;
  const q = (selector) => panel.querySelector(selector);
  const qa = (selector) => [...panel.querySelectorAll(selector)];
  const sq = (selector) => scene.querySelector(selector);
  const sqa = (selector) => [...scene.querySelectorAll(selector)];
  const fmt = (value, digits = 0) => new Intl.NumberFormat('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

  let state = createOperationState();
  let mode = 'loading';
  let autoClock = true;
  let flowPhase = 0;

  const svgNS = 'http://www.w3.org/2000/svg';
  const B = data.basis;
  const T = data.tank;
  const project = (x, y, z) => [B.o[0] + B.x[0] * x + B.y[0] * y + B.z[0] * z, B.o[1] + B.x[1] * x + B.y[1] * y + B.z[1] * z];
  const poly = (points) => `M${points.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L')}Z`;
  const bath = {
    frontFill: sq('[data-op-bath="front"] .op-bath-fill'), frontEdge: sq('[data-op-bath="front"] .op-bath-edge'),
    topFill: sq('[data-op-bath="top"] .op-bath-fill'), topEdge: sq('[data-op-bath="top"] .op-bath-edge'),
    flow: sq('[data-op-bath="front"] .op-flow'),
  };
  const particles = Array.from({ length: 7 }, () => {
    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('class', 'op-particle');
    dot.setAttribute('r', '2');
    bath.flow.append(dot);
    return dot;
  });
  const windows = Object.fromEntries(Object.entries(data.windows).map(([id, w]) => [id, { ...w, fill: sq(`[data-fill="${id}"]`), text: sq(`[data-text="${id}"]`), cache: '' }]));
  const parts = sqa('[data-op-part]');
  const lamps = sqa('[data-op-lamp]');
  const lids = sqa('[data-op-lid]');
  const shows = sqa('[data-op-show]');
  const films = sqa('[data-op-film]');
  const read = Object.fromEntries(qa('[data-op-read]').map((node) => [node.dataset.opRead, node]));
  const readCache = {};
  const tabs = qa('[role="tab"]');
  const panels = qa('[role="tabpanel"]');
  const toggles = qa('[data-op-toggle]');
  const live = q('#op-status');
  const formula = q('[data-op-formula]');
  const readyBox = q('.op-ready');
  const autoButton = q('#op-auto');
  const readout = ctx.root.querySelector('[data-op-readout]');

  function setText(key, node, value) {
    if (readCache[key] === value) return;
    readCache[key] = value;
    node.textContent = value;
  }
  function windowLevel(id, fraction) {
    const w = windows[id];
    const f = Math.max(0, Math.min(1, fraction));
    const d = f > 0 ? poly([w.o, [w.o[0] + w.ex[0] * w.w, w.o[1] + w.ex[1] * w.w], [w.o[0] + w.ex[0] * w.w + w.ez[0] * w.h * f, w.o[1] + w.ex[1] * w.w + w.ez[1] * w.h * f], [w.o[0] + w.ez[0] * w.h * f, w.o[1] + w.ez[1] * w.h * f]]) : '';
    if (w.cache !== d) { w.cache = d; w.fill.setAttribute('d', d); }
  }
  function windowText(id, value, alert = false) {
    const w = windows[id];
    if (w.cache === value + alert) return;
    w.cache = value + alert;
    w.text.textContent = value;
    // Fit the instrument's own digits to its window: mono glyphs are about .62 em wide, with a margin each side.
    const size = Math.min(w.h * 0.66, (w.w * 0.86) / Math.max(1, value.length * 0.62));
    w.text.setAttribute('font-size', size.toFixed(2));
    w.text.setAttribute('y', (w.h / 2 + size * 0.36).toFixed(2));
    w.text.parentNode.dataset.alert = String(alert);
  }
  let bathCache = '';
  function drawBath(s) {
    const level = T.floor + (T.weir - T.floor) * Math.min(1, s.tankMl / OPERATION_SPEC.tankCapacityMl);
    const key = s.tankMl > 0 ? level.toFixed(2) : 'empty';
    if (key === bathCache) return level;
    bathCache = key;
    if (s.tankMl <= 0) {
      for (const node of [bath.frontFill, bath.frontEdge, bath.topFill, bath.topEdge]) node.setAttribute('d', '');
      return level;
    }
    const front = poly([project(T.x0, T.y1, T.floor), project(T.x1, T.y1, T.floor), project(T.x1, T.y1, level), project(T.x0, T.y1, level)]);
    bath.frontFill.setAttribute('d', front);
    bath.frontEdge.setAttribute('d', front);
    // The free surface is only drawn where it lies above every submerged part (geometry's surfaceMin).
    const top = level > T.surfaceMin ? poly([project(T.x0, T.y0, level), project(T.x1, T.y0, level), project(T.x1, T.y1, level), project(T.x0, T.y1, level)]) : '';
    bath.topFill.setAttribute('d', top);
    bath.topEdge.setAttribute('d', top);
    return level;
  }
  function drawFlow(s, level) {
    const show = s.pumpOn && s.tankMl > 0;
    bath.flow.setAttribute('display', show ? 'inline' : 'none');
    if (!show) return;
    // Circulation in the section plane: up from the feed boss, across under the surface, down to the suction boss.
    const inset = Math.min(4, (level - T.floor) / 4);
    const zBottom = T.floor + inset;
    const zTop = Math.min(level - inset, T.floor + 52);
    const legs = [[T.outletX, zBottom], [T.outletX, zTop], [T.inletX, zTop], [T.inletX, zBottom]];
    const lengths = legs.slice(1).map((p, i) => Math.hypot(p[0] - legs[i][0], p[1] - legs[i][1]));
    const total = lengths.reduce((a, b) => a + b, 0);
    particles.forEach((dot, i) => {
      let d = ((flowPhase + i / particles.length) % 1) * total;
      let leg = 0;
      while (leg < lengths.length - 1 && d > lengths[leg]) { d -= lengths[leg]; leg += 1; }
      const t = lengths[leg] ? d / lengths[leg] : 0;
      const x = legs[leg][0] + (legs[leg + 1][0] - legs[leg][0]) * t;
      const z = legs[leg][1] + (legs[leg + 1][1] - legs[leg][1]) * t;
      const [px, py] = project(x, T.y1 - 0.05, z);
      dot.setAttribute('cx', px.toFixed(2));
      dot.setAttribute('cy', py.toFixed(2));
    });
  }
  const clockTime = (seconds) => {
    const whole = Math.floor(seconds);
    return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
  };
  function clockNeeded(s) {
    const status = operationStatus(s);
    const dosing = s.pendingDoseMl > 1e-9 && s.stockMl > 1e-9 && s.tankMl > 0;
    if (s.tankMl <= 0) return dosing;
    // Pause only at the exact ideal holding state or ambient equilibrium, never just below target.
    const holding = s.heatRequested && status.heaterAllowed && s.tempC === OPERATION_SPEC.targetC;
    const settled = Math.abs(s.tempC - OPERATION_SPEC.ambientC) < 0.005;
    return dosing || s.heaterOn || !(holding || settled);
  }
  function render() {
    const s = state;
    const status = operationStatus(s);
    const level = drawBath(s);
    drawFlow(s, level);
    const target = OPERATION_SPEC.targetC;
    const inBand = Math.abs(s.tempC - target) <= OPERATION_SPEC.toleranceC + 1e-10;
    windowText('temp', s.tankMl > 0 ? fmt(s.tempC, 1) : '– –', s.tankMl > 0 && !inBand);
    windowText('setpoint', fmt(target, 1));
    windowText('flag-lid', s.lidClosed ? 'KÍN' : 'MỞ', !s.lidClosed);
    windowText('flag-seal', s.sealIntact ? 'OK' : 'HỞ', !s.sealIntact);
    windowText('flag-gate', s.filmFogged ? 'FOG' : s.filmInGate ? 'PHIM' : '—', s.filmFogged);
    windowText('dose', s.pendingDoseMl > 0 ? `${fmt(s.pendingDoseMl, 1)} mL` : `${fmt(s.totalDosedMl, 0)} mL`, s.pendingDoseMl > 0 && s.stockMl <= 0);
    windowLevel('stock', s.stockMl / OPERATION_SPEC.stockCapacityMl);
    windowLevel('waste', s.wasteMl / OPERATION_SPEC.stockCapacityMl);
    for (const lamp of lamps) {
      const on = lamp.dataset.opLamp === 'heater' ? s.heaterOn : lamp.dataset.opLamp === 'pump' ? s.pumpOn : status.ready;
      if (lamp.dataset.on !== String(on)) lamp.dataset.on = String(on);
    }
    for (const lid of lids) lid.setAttribute('display', (lid.dataset.opLid === 'closed') === s.lidClosed ? 'inline' : 'none');
    const visible = { cassette: s.cassetteLoaded, leader: s.leaderAttached, gate: s.filmInGate };
    for (const node of shows) node.setAttribute('display', visible[node.dataset.opShow] ? 'inline' : 'none');
    const accent = ACCENTS[mode];
    for (const part of parts) {
      const on = accent.includes(part.dataset.opPart) ? 'true' : 'false';
      if (part.dataset.accent !== on) part.dataset.accent = on;
      if (part.dataset.opPart === 'heater' && part.dataset.heat !== String(s.heaterOn)) part.dataset.heat = String(s.heaterOn);
    }
    for (const film of films) {
      film.dataset.fogged = String(s.filmFogged);
      film.dataset.accent = String(mode === 'loading');
    }
    // These are idempotent command buttons, not reversible toggle buttons.
    for (const button of toggles) button.dataset.active = String(TOGGLES[button.dataset.opToggle](s));

    // The mechanism states drawn in the scene, as ordinary text in the readout region.
    setText('loadbox', read.loadbox, `Nắp ${s.lidClosed ? 'đóng' : 'mở'} · gioăng ${s.sealIntact ? 'kín' : 'hở'}`);
    setText('roll', read.roll, `Cassette ${s.cassetteLoaded ? 'đã đặt' : 'chưa đặt'} · leader ${s.leaderAttached ? 'đã nối' : 'chưa nối'} · đường dẫn: ${s.filmFogged ? 'FOG, cuộn đã lộ sáng' : s.filmInGate ? 'có đoạn ảnh, kín sáng' : 'chưa có phim'}`);
    setText('pump', read.pump, s.pumpOn ? 'Đang bật' : 'Tắt');
    setText('temp', read.temp, s.tankMl > 0 ? `${fmt(s.tempC, 2)} °C · mốc ${fmt(target, 1)} ± ${fmt(OPERATION_SPEC.toleranceC, 2)}` : 'Bể trống');
    setText('heater', read.heater, s.heaterOn ? `Đang cấp nhiệt (${fmt(OPERATION_SPEC.heaterWatts)} W giả định)` : s.heatRequested ? (status.heaterAllowed ? 'Bộ điều nhiệt ngắt ở mốc' : `Bị liên động chặn: cần ≥ ${fmt(OPERATION_SPEC.minHeaterMl)} mL và bơm bật`) : 'Không yêu cầu');
    setText('tank', read.tank, `${fmt(s.tankMl, 1)} / ${fmt(OPERATION_SPEC.tankCapacityMl)} mL${s.evaporatedMl > 0 ? ` · bay hơi đã biết ${fmt(s.evaporatedMl, 0)} mL` : ''}`);
    setText('stock', read.stock, `${fmt(s.stockMl, 1)} / ${fmt(OPERATION_SPEC.stockCapacityMl)} mL replenisher pha sẵn`);
    const requested = s.rollsRecorded * CHEMISTRY_PROFILE.developerMlPerUnit;
    setText('dose', read.dose, `Yêu cầu ${fmt(requested, 0)} mL · đã giao ${fmt(s.totalDosedMl, 1)} mL · chờ ${fmt(s.pendingDoseMl, 1)} mL`);
    setText('waste', read.waste, `${fmt(s.wasteMl, 1)} mL đã tràn (cửa sổ thang ${fmt(OPERATION_SPEC.stockCapacityMl)} mL)`);
    setText('sim', read.sim, `${clockTime(s.simSeconds)} · ×${OPERATION_SPEC.timeScale}`);
    const needed = clockNeeded(s);
    const running = isTicking() && autoClock && needed && ctx.clockAllowed();
    setText('clock', read.clock, reduced.matches ? 'Giảm chuyển động: đồng hồ không tự chạy. Dùng “Tiến 30 giây mô phỏng”.'
      : running ? `Thời gian mô phỏng ×${OPERATION_SPEC.timeScale} đang chạy`
        : needed ? (autoClock ? `Thời gian mô phỏng ×${OPERATION_SPEC.timeScale} · chờ máy hoặc bảng đo vào khung nhìn` : 'Đồng hồ tự chạy đang tắt')
          : s.heatRequested && status.heaterAllowed && s.tempC === target ? 'Đã đạt mốc: tạm dừng đồng hồ ở trạng thái giữ nhiệt lý tưởng. Vẫn có thể tiến bước.'
            : `Thời gian mô phỏng ×${OPERATION_SPEC.timeScale} · không có quá trình cần thời gian`);
    setText('ready', read.ready, status.ready ? 'Bể hiện sẵn sàng (giáo dục)' : 'Chưa sẵn sàng');
    readyBox.dataset.opReady = String(status.ready);
    const chemistryFaults = status.issues.filter(({ id }) => id === 'oxidized' || id === 'contaminated');
    setText('reason', read.reason, status.ready ? 'Vẫn cần nhiệt kế chính xác và control strip; đây không phải phê duyệt chất lượng.' : chemistryFaults.length ? chemistryFaults.map(({ detail }) => detail).join(' ') : status.blockedReason);
    setText('event', read.event, s.lastEvent);
    if (formula) setText('formula', formula, `${fmt(CHEMISTRY_PROFILE.developerMlPerUnit)} mL × ${fmt(s.rollsRecorded)} cuộn = ${fmt(requested)} mL yêu cầu · đã giao ${fmt(s.totalDosedMl, 1)} mL`);
    setText('readout', readout, s.tankMl > 0 ? `Bể hiện ${fmt(s.tempC, 1)} °C · ${fmt(s.tankMl, 0)} mL${status.ready ? ' · sẵn sàng' : ''}` : 'Bể hiện trống');
    autoButton.setAttribute('aria-pressed', String(autoClock));
    autoButton.disabled = reduced.matches;
    ctx.onState(s, status);
  }
  function announce(message) { live.textContent = message; }
  function phaseNotes(before, after) {
    const notes = [];
    const was = operationStatus(before).ready;
    const now = operationStatus(after).ready;
    if (was !== now) notes.push(now ? 'Bể hiện đạt trạng thái sẵn sàng giáo dục.' : 'Bể hiện không còn sẵn sàng.');
    if (before.pendingDoseMl > 0 && after.pendingDoseMl <= 1e-9) notes.push('Đã giao đủ liều châm bù.');
    if (before.stockMl > 0 && after.stockMl <= 0) notes.push('Bình replenisher đã hết.');
    return notes;
  }
  function commit(next, { user = false } = {}) {
    const before = state;
    state = next;
    const notes = phaseNotes(before, state);
    if (user) announce([state.lastEvent, ...notes].join(' '));
    else if (notes.length) announce(notes.join(' '));
    ctx.wake();
    render();
  }
  function act(action) { if (!ctx.interactive()) return; commit(applyOperation(state, action), { user: true }); }
  function stepClock(seconds) {
    if (!ctx.interactive()) return;
    const before = state;
    state = advanceOperation(state, seconds);
    const s = state;
    const what = s.tankMl > 0 ? `bể ${fmt(s.tempC, 2)} °C, ${fmt(s.tankMl, 1)} mL` : 'bể trống';
    announce([`Đã tiến ${seconds} giây mô phỏng: ${what}${s.pendingDoseMl > 0 ? `, còn chờ ${fmt(s.pendingDoseMl, 1)} mL` : ''}.`, ...phaseNotes(before, s)].join(' '));
    ctx.wake();
    render();
  }

  function selectMode(next, { focusTab = false, user = false } = {}) {
    if (!ctx.interactive()) return;
    mode = next;
    tabs.forEach((tab) => {
      const on = tab.dataset.opMode === next;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focusTab) tab.focus();
    });
    panels.forEach((node) => { node.hidden = node.id !== `op-panel-${next}`; });
    // A chosen topic magnifies its region of the same machine; the state itself never changes.
    if (user) ctx.onMode(next);
    render();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectMode(tab.dataset.opMode, { user: true }));
    tab.addEventListener('keydown', (event) => {
      const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
      if (!(event.key in moves)) return;
      event.preventDefault();
      selectMode(tabs[(moves[event.key] + tabs.length) % tabs.length].dataset.opMode, { focusTab: true, user: true });
    });
  });
  qa('[data-op-action]').forEach((button) => button.addEventListener('click', () => act(JSON.parse(button.dataset.opAction))));
  q('#op-step').addEventListener('click', () => stepClock(STEP_SECONDS));
  autoButton.addEventListener('click', () => { if (!ctx.interactive()) return; autoClock = !autoClock; ctx.wake(); render(); });
  q('#op-reset').addEventListener('click', () => act({ type: 'reset' }));
  q('#op-guided').addEventListener('click', () => {
    if (!ctx.interactive()) return;
    // Teaching demonstration: the same reducer actions a user could press, in order. No temperature is set.
    let next = state;
    if (next.tankMl === 0) next = applyOperation(next, { type: 'fillTank' });
    next = applyOperation(next, { type: 'setPump', on: true });
    next = applyOperation(next, { type: 'setHeater', on: true });
    selectMode('heating', { user: true });
    commit(next);
    const allowed = operationStatus(next).heaterAllowed;
    announce(`Minh họa: đã nạp bể (nếu trống), bật bơm và yêu cầu nhiệt bằng các thao tác của mô hình. ${!allowed ? next.lastEvent : reduced.matches ? 'Dùng “Tiến 30 giây mô phỏng” để thời gian trôi.' : `Thời gian nhiệt tiến theo mô hình ×${OPERATION_SPEC.timeScale}.`}`);
  });

  return {
    snapshot: () => ({ topic: mode, autoClock, state: structuredClone(state) }),
    render,
    // One step of the shared frame loop. Returns true while the clock or the circulation marks need frames.
    step(dt, allow) {
      if (reduced.matches) return false;
      const runClock = allow.clock && autoClock && clockNeeded(state);
      const runFlow = allow.flow && state.pumpOn && state.tankMl > 0;
      if (!runClock && !runFlow) return false;
      const t = Math.min(dt, MAX_FRAME);
      if (runFlow) flowPhase = (flowPhase + t * 0.12) % 1;
      if (runClock && t > 0) {
        const before = state;
        state = advanceOperation(state, t * OPERATION_SPEC.timeScale);
        const notes = phaseNotes(before, state);
        if (notes.length) announce(notes.join(' '));
      }
      return true;
    },
  };
}

// src/unified-controller.mjs

// One machine, one scene SVG, one camera and one frame loop. The build inlines the pure models and the
// runtime modules into a single strict function scope and calls startUnifiedFigure once with the data of
// the single machine. The tour, the camera, the operating clock and the circulation marks are steps of
// the same tick; one visibility and reduced-motion policy decides which of them may advance.
const FOCUS_STAGE = Object.freeze({ loading: 0, developer: 1, bleach: 2, fix: 3, rinse: 4, dry: 5 });
const STAGE_FOCUS = Object.freeze(['loading', 'developer', 'bleach', 'fix', 'rinse', 'dry']);
const TOPIC_FOCUS = Object.freeze({ loading: 'loading', heating: 'developer', fill: 'developer', replenishment: 'replenishment', quality: 'developer' });
const CAMERA_TAU = 0.22; // seconds; the viewBox eases, the card never changes size

function createSceneCamera({ svg, boxes, still }) {
  const base = svg.viewBox.baseVal;
  const aspect = base.width / base.height;
  // Every focus box is shown at the scene's own aspect, so the card height stays fixed while it eases.
  const fit = ([x, y, w, h]) => (w / h > aspect
    ? [x, y + h / 2 - w / aspect / 2, w, w / aspect]
    : [x + w / 2 - (h * aspect) / 2, y, h * aspect, h]);
  const frames = Object.fromEntries(Object.entries(boxes).map(([key, box]) => [key, fit(box)]));
  let key = 'all';
  let target = frames.all;
  let current = [...target];
  let written = '';
  function write() {
    const value = current.map((v) => v.toFixed(2)).join(' ');
    if (value !== written) { written = value; svg.setAttribute('viewBox', value); }
  }
  write();
  return {
    has: (next) => Object.hasOwn(frames, next),
    key: () => key,
    snapshot: () => ({ key, viewBox: [...current], target: [...target] }),
    set(next) {
      if (!Object.hasOwn(frames, next)) return false;
      key = next;
      target = frames[next];
      if (still.matches) { current = [...target]; write(); }
      return true;
    },
    // Returns true while the camera still moves.
    step(dt) {
      if (still.matches) { current = [...target]; write(); return false; }
      const k = 1 - Math.exp(-dt / CAMERA_TAU);
      let moving = false;
      current = current.map((v, i) => {
        const next = v + (target[i] - v) * k;
        if (Math.abs(target[i] - next) > 0.05) { moving = true; return next; }
        return target[i];
      });
      write();
      return moving;
    },
    snap() { current = [...target]; write(); },
    // Pointer x across the visible card, as a fraction of the whole-machine frame.
    wholeFraction(u) { return (current[0] + u * current[2] - frames.all[0]) / frames.all[2]; },
  };
}

function startUnifiedFigure(DATA, options = {}) {
  const root = options.root ?? document.body;
  if (root.htwC41) return root.htwC41;
  const themeRoot = options.themeRoot ?? root;
  const storageKey = options.storageKey ?? 'film-processor-theme';
  let mode = options.mode ?? 'explore';
  if (!['reader', 'explore'].includes(mode)) throw new Error('Invalid figure mode');
  root.dataset.mode = mode;
  const $ = (selector) => root.querySelector(selector);
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const region = options.region ?? $('.experience') ?? root;
  const sceneRoot = $('#machine-scene');
  const consoleRoot = $('#operation');
  // The live readouts the clock text refers to; an unrelated console heading on screen does not run time.
  const readoutRoot = consoleRoot.querySelector('.op-side');
  const status = $('#status');
  const truth = { root: $('#machine-truth'), text: $('[data-truth-text]'), cache: '' };
  const cameraLabel = $('[data-camera-label]');
  const focusButtons = [...root.querySelectorAll('[data-focus-machine]')];
  const camera = createSceneCamera({ svg: sceneRoot.querySelector('svg'), boxes: DATA.focus, still });

  let sceneVisible = false;
  let consoleVisible = false;
  let frame = 0;
  let last = 0;
  let previewCaveat = '';
  let pendingUpdate = null;
  const interactive = () => mode === 'explore';

  // The single visibility policy: motion only for what a reader can see, never catching up hidden time.
  const policy = {
    scene: () => sceneVisible && !document.hidden,
    // Model time may advance while the machine or its live readouts are on screen.
    clock: () => interactive() && (sceneVisible || consoleVisible) && !document.hidden && !still.matches,
    flow: () => interactive() && sceneVisible && !document.hidden && !still.matches,
  };

  function wake() {
    if (frame || document.hidden || (!sceneVisible && !consoleVisible)) return;
    last = 0;
    frame = requestAnimationFrame(tick);
  }
  function tick(now) {
    // Embed layout work runs while this frame is still owned, so a camera change inside it cannot start a
    // second loop; its easing continues below in the same tick.
    const update = pendingUpdate;
    pendingUpdate = null;
    if (update) update();
    frame = 0;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    const scene = policy.scene();
    const touring = interactive() && scene && tour.step(dt);
    const panning = scene && camera.step(dt);
    const operating = operation.step(dt, { clock: policy.clock(), flow: policy.flow() });
    if (touring || panning || operating) frame = requestAnimationFrame(tick);
    operation.render();
  }

  function labelOf(key) {
    const button = focusButtons.find((node) => node.dataset.focusMachine === key);
    return button ? button.dataset.focusLabel : key;
  }
  function focusMachine(key, { announceChange = true } = {}) {
    const changed = camera.key() !== key;
    if (!camera.set(key)) return;
    sceneRoot.dataset.focus = key;
    focusButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.focusMachine === key)));
    cameraLabel.textContent = key === 'all' ? 'Máy C‑41 · toàn máy' : `Cận cảnh · ${labelOf(key)}`;
    if (changed && interactive()) tour.cameraChanged();
    const stage = Object.hasOwn(FOCUS_STAGE, key) ? ` Xem trước công đoạn ${STAGES[FOCUS_STAGE[key]].title}.` : '';
    if (announceChange) status.textContent = key === 'all' ? 'Khung nhìn toàn máy.' : `Cận cảnh ${labelOf(key)} trên cùng một máy. Chỉ khung nhìn thay đổi; trạng thái máy giữ nguyên.${stage}${previewCaveat}`;
    wake();
  }
  // A discrete stage choice while a stage region is magnified follows the film to that stage's region.
  function followStage(index) {
    const key = camera.key();
    if (Object.hasOwn(FOCUS_STAGE, key) && STAGE_FOCUS[index] !== key) focusMachine(STAGE_FOCUS[index], { announceChange: false });
  }

  function syncTruth(s, opStatus) {
    const chemistry = opStatus.issues.filter(({ id }) => id === 'oxidized' || id === 'contaminated');
    let level = 'preview';
    let message;
    if (s.filmFogged) {
      level = 'fault';
      message = 'Lỗi thật trên máy: cuộn demo trong hộp nạp đã lộ sáng (cờ FOG). Dải xem trước không tạo ra âm bản dùng được; bỏ cuộn hoặc đặt lại demo.'
        + (chemistry.length ? ` Bể hiện cũng có lỗi đã khai báo: ${chemistry.map(({ title }) => title.toLowerCase()).join(', ')}.` : '');
    } else if (chemistry.length) {
      level = 'fault';
      message = `Lỗi hóa chất đã khai báo trên bể hiện: ${chemistry.map(({ title }) => title.toLowerCase()).join(', ')}. Dải xem trước không có nghĩa bể dùng được.`;
    } else if (s.tankMl <= 0) {
      message = 'Bể hiện đang trống. Dải phim là xem trước đường đi, máy chưa xử lý phim nào.';
    } else if (!opStatus.ready) {
      message = `Bể hiện chưa sẵn sàng: ${opStatus.issues[0].title.toLowerCase()}. Dải phim là xem trước đường đi, không phải phim đang được tráng.`;
    } else if (s.filmInGate) {
      level = 'live';
      message = 'Đoạn ảnh thật đã vào đường dẫn kín trong hộp nạp (viền liền). Phần dải còn lại vẫn là xem trước; mô hình chưa mô phỏng tráng hoàn tất.';
    } else {
      level = 'ready';
      message = 'Bể hiện sẵn sàng (giáo dục). Dải phim vẫn là xem trước cho tới khi cuộn được đưa vào qua bảng vận hành.';
    }
    previewCaveat = level === 'fault' ? ` Lưu ý: ${message}` : '';
    // Scene datasets follow every state: an unchanged message (e.g. a fog note) can hide a readiness change.
    for (const [name, value] of [['machineReady', opStatus.ready], ['filmLive', s.filmInGate && !s.filmFogged], ['filmFogged', s.filmFogged]]) {
      if (sceneRoot.dataset[name] !== String(value)) sceneRoot.dataset[name] = String(value);
    }
    const key = level + message;
    if (truth.cache === key) return;
    truth.cache = key;
    truth.root.dataset.level = level;
    truth.text.textContent = message;
  }

  const tour = createProcessTour({
    data: DATA,
    root: sceneRoot,
    uiRoot: root,
    interactive,
    region,
    still,
    isActive: () => interactive() && policy.scene(),
    wake,
    announce: (text) => { status.textContent = text + previewCaveat; },
    cameraWhole: () => camera.key() === 'all',
    beforePlay: () => focusMachine('all', { announceChange: false }),
    onStageChosen: followStage,
    onEscape: () => focusMachine('all'),
    pointerFraction: (u) => camera.wholeFraction(u),
  });
  const operation = createOperationConsole({
    data: DATA.operation,
    root,
    interactive,
    scene: sceneRoot,
    panel: consoleRoot,
    reduced: still,
    wake,
    isTicking: () => frame !== 0,
    clockAllowed: policy.clock,
    onMode: (mode) => focusMachine(TOPIC_FOCUS[mode]),
    onState: syncTruth,
  });

  focusButtons.forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.focusMachine;
    // A stage region also moves the path preview there; one announcement names both.
    if (interactive() && Object.hasOwn(FOCUS_STAGE, key)) tour.seek(stageProgress(FOCUS_STAGE[key]), { announceChange: false, chosen: false });
    focusMachine(key);
  }));

  const themeButton = $('#theme');
  function readTheme() {
    try { return localStorage.getItem(storageKey); }
    catch (error) { themeRoot.dataset.storage = error.name; return null; }
  }
  const savedTheme = readTheme();
  if (savedTheme === 'light' || savedTheme === 'dark') themeRoot.dataset.theme = savedTheme;
  function syncThemeButton() {
    const dark = themeRoot.dataset.theme === 'dark';
    themeButton.setAttribute('aria-pressed', String(dark));
    themeButton.querySelector('span').textContent = dark ? 'Nền sáng' : 'Nền tối';
  }
  syncThemeButton();
  themeButton.addEventListener('click', () => {
    themeRoot.dataset.theme = themeRoot.dataset.theme === 'dark' ? 'light' : 'dark';
    syncThemeButton();
    try { localStorage.setItem(storageKey, themeRoot.dataset.theme); }
    catch (error) { themeRoot.dataset.storage = error.name; }
  });

  function policyChanged() {
    if (!policy.scene()) camera.snap();
    tour.onActiveChange();
    wake();
    operation.render();
  }
  const observer = new IntersectionObserver((entries) => {
    // The newest entry per target wins: a fast leave-and-return delivers both, oldest first.
    for (const entry of entries) {
      if (entry.target === sceneRoot) sceneVisible = entry.isIntersecting;
      else if (entry.target === readoutRoot) consoleVisible = entry.isIntersecting;
    }
    policyChanged();
  }, { rootMargin: '0px', threshold: 0.01 });
  observer.observe(sceneRoot);
  observer.observe(readoutRoot);
  document.addEventListener('visibilitychange', policyChanged);
  still.addEventListener('change', () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    camera.snap();
    tour.onReducedChange();
    operation.render();
    wake();
  });
  focusMachine('all', { announceChange: false });
  tour.start();
  operation.render();
  const api = Object.freeze({
    focusMachine,
    setMode(next) {
      if (!['reader', 'explore'].includes(next)) throw new Error('Invalid figure mode');
      if (mode === next) return;
      mode = next;
      root.dataset.mode = mode;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      pendingUpdate = null;
      last = 0;
      if (options.onModeChange) options.onModeChange(mode);
      tour.onActiveChange();
      operation.render();
      wake();
    },
    // Layout work requested by the embed shares this controller's frame, never another RAF loop.
    requestUpdate(update) {
      pendingUpdate = update;
      wake();
      // No frame may run (scene and readouts off screen, or a hidden tab): apply the layout work at once.
      if (!frame && pendingUpdate) { pendingUpdate = null; update(); }
    },
    snapshot: () => ({ mode, camera: camera.snapshot(), progress: tour.snapshot(), operation: operation.snapshot() }),
  });
  Object.defineProperty(root, 'htwC41', { value: api });
  return api;
}

// src/embed-mount.mjs

// Blog bootstrap for the one C‑41 machine inside an authored article. It mounts the existing controller on
// the article root, so every query, theme write and state stays inside that root. Reading only moves the
// camera of the same scene; trying the machine is an explicit choice that moves the SAME scene node to the
// explore slot and reveals the original console. No second SVG, controller, state or frame loop is made:
// scroll work is handed to the controller's own frame through requestUpdate.
const EMBED_THEME_KEY = 'htw-c41-theme';
const READING_LINE = 0.4; // fraction of the unobscured reading area, not the sticky image band

function mountC41(DATA, doc = document) {
  const roots = doc.querySelectorAll('[data-htw-figure="c-41"]');
  if (roots.length !== 1) {
    console.error(`How Things Work C‑41: expected one [data-htw-figure="c-41"] root, found ${roots.length}; not mounted.`);
    return null;
  }
  const root = roots[0];
  if (root.htwC41) return root.htwC41;
  const scene = root.querySelector('[data-htw-scene]');
  const readerSlot = root.querySelector('[data-htw-reader-slot]');
  const exploreSlot = root.querySelector('[data-htw-explore-slot]');
  const controls = root.querySelector('[data-htw-explore-controls]');
  if (!scene || !readerSlot || !exploreSlot || !controls) {
    console.error('How Things Work C‑41: scene, reader slot, explore slot or console slot missing; not mounted.');
    return null;
  }
  const steps = [...root.querySelectorAll('[data-htw-story] [data-htw-step]')]
    .filter((node) => Object.hasOwn(DATA.focus, node.dataset.htwStep));
  const collapse = root.querySelector('[data-htw-collapse]');
  const tryRegion = exploreSlot.closest('#try') ?? root;

  // Place the one scene and its console before the controller measures or observes anything.
  const startMode = doc.defaultView.location.hash === '#try' ? 'explore' : 'reader';
  // The reader slot may hold authored chrome (status, collapse bar) after the include: the scene returns to
  // its own authored position, marked once by an inert comment, not to the end of the slot.
  const home = doc.createComment(' htw-c41 scene home ');
  if (readerSlot.contains(scene)) scene.before(home);
  else readerSlot.prepend(home);
  function place(mode) {
    if (mode === 'explore') exploreSlot.append(scene);
    else home.after(scene);
    controls.hidden = mode !== 'explore';
    controls.inert = mode !== 'explore';
  }
  place(startMode);
  let mode = startMode;
  let chapter = null;
  const controller = startUnifiedFigure(DATA, {
    root, themeRoot: root, region: tryRegion, storageKey: EMBED_THEME_KEY, mode,
    onModeChange(next) { mode = next; place(next); chapter = null; },
  });
  // Passive reading: the chapter crossing the reading line chooses a camera region, nothing else.
  function chooseChapter() {
    if (mode !== 'reader' || !steps.length) return;
    const height = doc.defaultView.innerHeight;
    const band = readerSlot.getBoundingClientRect();
    const prose = root.querySelector('[data-htw-story]')?.getBoundingClientRect();
    // On a stacked layout the sticky figure covers the top of the text viewport. On desktop it sits
    // beside the prose. Use the actual column overlap rather than duplicating a CSS breakpoint.
    const stacked = prose && Math.min(band.right, prose.right) > Math.max(band.left, prose.left);
    const textTop = stacked ? Math.min(height * 0.65, Math.max(0, band.bottom)) : 0;
    const line = textTop + (height - textTop) * READING_LINE;
    let current = steps[0];
    for (const step of steps) {
      if (step.getBoundingClientRect().top <= line) current = step;
      else break;
    }
    if (current === chapter) return;
    chapter = current;
    controller.focusMachine(current.dataset.htwStep, { announceChange: false });
  }
  const readLater = () => controller.requestUpdate(chooseChapter);

  function setMode(next) {
    if ((next !== 'reader' && next !== 'explore') || next === mode) return;
    // Placement is an onModeChange hook, so API calls and buttons share the same mode transition.
    // Do not choose a chapter here: the camera stays put until a subsequent reading navigation.
    controller.setMode(next);
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-htw-mode]');
    if (button && root.contains(button)) setMode(button.dataset.htwMode);
  });
  if (collapse) {
    const setCollapsed = (collapsed) => {
      root.dataset.htwCollapsed = String(collapsed);
      collapse.setAttribute('aria-expanded', String(!collapsed));
    };
    setCollapsed(collapse.getAttribute('aria-expanded') === 'false');
    collapse.addEventListener('click', () => setCollapsed(root.dataset.htwCollapsed !== 'true'));
  }
  // Keyboard reading: focus entering a chapter (a heading link or tab stop) chooses it like scrolling does.
  root.addEventListener('focusin', (event) => {
    const step = event.target.closest?.('[data-htw-step]');
    if (!step || !steps.includes(step) || mode !== 'reader') return;
    chapter = step;
    controller.focusMachine(step.dataset.htwStep, { announceChange: false });
  });
  doc.defaultView.addEventListener('scroll', readLater, { passive: true });
  doc.defaultView.addEventListener('resize', readLater, { passive: true });
  doc.defaultView.addEventListener('hashchange', () => { if (doc.defaultView.location.hash === '#try') setMode('explore'); });
  readLater();
  return controller;
}

// The static script may load in <head> or at the end of <body>; mount once the article DOM exists.
function bootC41(DATA, doc = document) {
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => mountC41(DATA, doc), { once: true });
  else mountC41(DATA, doc);
}

bootC41({"total":1626.42,"bounds":[0,44,330.31,612.09,893.87,1175.65,1626.42],"chunks":[{"a0":0,"a1":12,"o":[246.17,151.57],"ea":[1.233,0.3007],"ey":[-0.6014,0.6165],"edgeO":[231.73,166.76],"edgeE":[1.233,0.3007],"stage":0,"dev":0},{"a0":12,"a1":21,"o":[260.97,155.18],"ea":[1.233,0.3007],"ey":[-0.6014,0.6165],"edgeO":[246.52,170.36],"edgeE":[1.233,0.3007],"stage":0,"dev":0},{"a0":21,"a1":30,"o":[272.07,157.88],"ea":[1.233,0.3007],"ey":[-0.6014,0.6165],"edgeO":[257.62,173.07],"edgeE":[1.233,0.3007],"stage":0,"dev":0},{"a0":30,"a1":37,"o":[283.16,160.59],"ea":[1.233,0.3007],"ey":[-0.6014,0.6165],"edgeO":[268.72,175.78],"edgeE":[1.233,0.3007],"stage":0,"dev":0},{"a0":37,"a1":44,"o":[291.79,162.69],"ea":[1.233,0.3007],"ey":[-0.6014,0.6165],"edgeO":[277.35,177.88],"edgeE":[1.233,0.3007],"stage":0,"dev":0},{"a0":44,"a1":47.13262861328123,"o":[300.42,164.8],"ea":[1.255,0.4653],"ey":[-0.6014,0.6165],"edgeO":[285.98,179.99],"edgeE":[1.2224,0.4532],"stage":1,"dev":0},{"a0":47.13262861328123,"a1":50.265257226562476,"o":[304.35,166.25],"ea":[1.1695,0.752],"ey":[-0.6014,0.6165],"edgeO":[289.81,181.4],"edgeE":[1.1391,0.7324],"stage":1,"dev":0},{"a0":50.265257226562476,"a1":53.39788583984372,"o":[308.02,168.61],"ea":[1.0043,0.9874],"ey":[-0.6014,0.6165],"edgeO":[293.38,183.7],"edgeE":[0.9782,0.9618],"stage":1,"dev":0},{"a0":53.39788583984372,"a1":56.53051445312496,"o":[311.16,171.7],"ea":[0.7706,1.1556],"ey":[-0.6014,0.6165],"edgeO":[296.44,186.71],"edgeE":[0.7506,1.1256],"stage":1,"dev":0},{"a0":56.53051445312496,"a1":59.66314306640621,"o":[313.58,175.32],"ea":[0.4844,1.245],"ey":[-0.6014,0.6165],"edgeO":[298.79,190.24],"edgeE":[0.4718,1.2126],"stage":1,"dev":0},{"a0":59.66314306640621,"a1":62.795771679687434,"o":[315.1,179.22],"ea":[0.1652,1.2495],"ey":[-0.6014,0.6165],"edgeO":[300.27,194.04],"edgeE":[0.1609,1.2171],"stage":1,"dev":0},{"a0":62.795771679687434,"a1":74.12910501302078,"o":[315.61,183.14],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[300.77,197.85],"edgeE":[0,1.188],"stage":1,"dev":0},{"a0":74.12910501302078,"a1":85.46243834635409,"o":[315.61,196.6],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[300.77,211.31],"edgeE":[0,1.188],"stage":1,"dev":0},{"a0":85.46243834635409,"a1":96.79577167968743,"o":[315.61,210.07],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[300.77,224.78],"edgeE":[0,1.188],"stage":1,"dev":0},{"a0":96.79577167968743,"a1":107.97577167968744,"o":[315.61,223.53],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[300.77,238.24],"edgeE":[0,1.188],"stage":1,"dev":1},{"a0":107.97577167968744,"a1":119.15577167968743,"o":[315.61,236.81],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[300.77,251.52],"edgeE":[0,1.188],"stage":1,"dev":1},{"a0":119.15577167968743,"a1":130.3357716796874,"o":[315.61,250.09],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[300.77,264.81],"edgeE":[0,1.188],"stage":1,"dev":1},{"a0":130.3357716796874,"a1":141.51577167968742,"o":[315.61,263.38],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[300.77,278.09],"edgeE":[0,1.188],"stage":1,"dev":1},{"a0":141.51577167968742,"a1":152.69577167968743,"o":[315.61,276.66],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[300.77,291.37],"edgeE":[0,1.188],"stage":1,"dev":1},{"a0":152.69577167968743,"a1":158.4389241373697,"o":[315.61,289.94],"ea":[0.1586,1.1994],"ey":[-0.6014,0.6165],"edgeO":[300.77,304.65],"edgeE":[0.1609,1.2171],"stage":1,"dev":1},{"a0":158.4389241373697,"a1":164.18207659505197,"o":[316.52,296.83],"ea":[0.465,1.195],"ey":[-0.6014,0.6165],"edgeO":[301.7,311.64],"edgeE":[0.4718,1.2126],"stage":1,"dev":1},{"a0":164.18207659505197,"a1":169.92522905273424,"o":[319.19,303.69],"ea":[0.7397,1.1092],"ey":[-0.6014,0.6165],"edgeO":[304.41,318.61],"edgeE":[0.7506,1.1256],"stage":1,"dev":1},{"a0":169.92522905273424,"a1":175.6683815104165,"o":[323.44,310.06],"ea":[0.9639,0.9478],"ey":[-0.6014,0.6165],"edgeO":[308.72,325.07],"edgeE":[0.9782,0.9618],"stage":1,"dev":1},{"a0":175.6683815104165,"a1":181.41153396809878,"o":[328.98,315.5],"ea":[1.1225,0.7218],"ey":[-0.6014,0.6165],"edgeO":[314.34,330.59],"edgeE":[1.1391,0.7324],"stage":1,"dev":1},{"a0":181.41153396809878,"a1":187.15468642578105,"o":[335.43,319.65],"ea":[1.2046,0.4466],"ey":[-0.6014,0.6165],"edgeO":[320.88,334.8],"edgeE":[1.2224,0.4532],"stage":1,"dev":1},{"a0":187.15468642578105,"a1":192.89783888346332,"o":[342.34,322.21],"ea":[1.2046,0.141],"ey":[-0.6014,0.6165],"edgeO":[327.9,337.4],"edgeE":[1.2224,0.143],"stage":1,"dev":1},{"a0":192.89783888346332,"a1":198.6409913411456,"o":[349.26,323.02],"ea":[1.1225,-0.1743],"ey":[-0.6014,0.6165],"edgeO":[334.92,338.22],"edgeE":[1.1391,-0.1768],"stage":1,"dev":1},{"a0":198.6409913411456,"a1":204.38414379882786,"o":[355.71,322.02],"ea":[0.9639,-0.4776],"ey":[-0.6014,0.6165],"edgeO":[341.46,337.21],"edgeE":[0.9782,-0.4847],"stage":1,"dev":1},{"a0":204.38414379882786,"a1":210.1272962565101,"o":[361.25,319.28],"ea":[0.7397,-0.7484],"ey":[-0.6014,0.6165],"edgeO":[347.08,334.42],"edgeE":[0.7506,-0.7595],"stage":1,"dev":1},{"a0":210.1272962565101,"a1":215.8704487141924,"o":[366.18,315.53],"ea":[0.4787,-0.9968],"ey":[-0.6014,0.6165],"edgeO":[351.39,330.06],"edgeE":[0.4718,-0.9825],"stage":1,"dev":1},{"a0":215.8704487141924,"a1":221.61360117187468,"o":[368.93,309.8],"ea":[0.1633,-1.1552],"ey":[-0.6014,0.6165],"edgeO":[354.1,324.42],"edgeE":[0.1609,-1.1386],"stage":1,"dev":1},{"a0":221.61360117187468,"a1":232.79360117187468,"o":[369.86,303.17],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[355.02,317.88],"edgeE":[0,-1.188],"stage":1,"dev":1},{"a0":232.79360117187468,"a1":243.9736011718747,"o":[369.86,289.89],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[355.02,304.6],"edgeE":[0,-1.188],"stage":1,"dev":1},{"a0":243.9736011718747,"a1":255.1536011718747,"o":[369.86,276.61],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[355.02,291.32],"edgeE":[0,-1.188],"stage":1,"dev":1},{"a0":255.1536011718747,"a1":266.33360117187465,"o":[369.86,263.32],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[355.02,278.04],"edgeE":[0,-1.188],"stage":1,"dev":1},{"a0":266.33360117187465,"a1":277.51360117187465,"o":[369.86,250.04],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[355.02,264.75],"edgeE":[0,-1.188],"stage":1,"dev":1},{"a0":277.51360117187465,"a1":288.84693450520797,"o":[369.86,236.76],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[355.02,251.47],"edgeE":[0,-1.188],"stage":1,"dev":1},{"a0":288.84693450520797,"a1":300.1802678385413,"o":[369.86,223.3],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[355.02,238.01],"edgeE":[0,-1.188],"stage":1,"dev":1},{"a0":300.1802678385413,"a1":311.5136011718746,"o":[369.86,209.83],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[355.02,224.54],"edgeE":[0,-1.188],"stage":1,"dev":1},{"a0":311.5136011718746,"a1":314.64622978515587,"o":[369.86,196.37],"ea":[0.1566,-1.1082],"ey":[-0.6014,0.6165],"edgeO":[355.02,211.08],"edgeE":[0.1609,-1.1386],"stage":1,"dev":1},{"a0":314.64622978515587,"a1":317.7788583984371,"o":[370.35,192.9],"ea":[0.4593,-0.9563],"ey":[-0.6014,0.6165],"edgeO":[355.53,207.51],"edgeE":[0.4718,-0.9825],"stage":1,"dev":1},{"a0":317.7788583984371,"a1":320.91148701171835,"o":[371.11,189.35],"ea":[0.7706,-0.7797],"ey":[-0.6014,0.6165],"edgeO":[357.01,204.43],"edgeE":[0.7506,-0.7595],"stage":1,"dev":1},{"a0":320.91148701171835,"a1":324.04411562499956,"o":[373.52,186.91],"ea":[1.0043,-0.4976],"ey":[-0.6014,0.6165],"edgeO":[359.36,202.06],"edgeE":[0.9782,-0.4847],"stage":1,"dev":1},{"a0":324.04411562499956,"a1":327.1767442382808,"o":[376.67,185.35],"ea":[1.1695,-0.1816],"ey":[-0.6014,0.6165],"edgeO":[362.42,200.54],"edgeE":[1.1391,-0.1768],"stage":1,"dev":1},{"a0":327.1767442382808,"a1":330.309372851562,"o":[380.33,184.78],"ea":[1.255,0.1469],"ey":[-0.6014,0.6165],"edgeO":[365.99,199.98],"edgeE":[1.2224,0.143],"stage":1,"dev":1},{"a0":330.309372851562,"a1":333.4420014648432,"o":[384.26,185.24],"ea":[1.255,0.4653],"ey":[-0.6014,0.6165],"edgeO":[369.82,200.43],"edgeE":[1.2224,0.4532],"stage":2,"dev":1},{"a0":333.4420014648432,"a1":336.5746300781244,"o":[388.2,186.7],"ea":[1.1695,0.752],"ey":[-0.6014,0.6165],"edgeO":[373.65,201.85],"edgeE":[1.1391,0.7324],"stage":2,"dev":1},{"a0":336.5746300781244,"a1":339.7072586914056,"o":[391.86,189.06],"ea":[1.0043,0.9874],"ey":[-0.6014,0.6165],"edgeO":[377.22,204.15],"edgeE":[0.9782,0.9618],"stage":2,"dev":1},{"a0":339.7072586914056,"a1":342.8398873046869,"o":[395.01,192.15],"ea":[0.7706,1.1556],"ey":[-0.6014,0.6165],"edgeO":[380.28,207.16],"edgeE":[0.7506,1.1256],"stage":2,"dev":1},{"a0":342.8398873046869,"a1":345.97251591796817,"o":[397.42,195.77],"ea":[0.4844,1.245],"ey":[-0.6014,0.6165],"edgeO":[382.63,210.68],"edgeE":[0.4718,1.2126],"stage":2,"dev":1},{"a0":345.97251591796817,"a1":349.1051445312494,"o":[398.94,199.67],"ea":[0.1652,1.2495],"ey":[-0.6014,0.6165],"edgeO":[384.11,214.48],"edgeE":[0.1609,1.2171],"stage":2,"dev":1},{"a0":349.1051445312494,"a1":360.43847786458275,"o":[399.45,203.58],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[384.62,218.3],"edgeE":[0,1.188],"stage":2,"dev":1},{"a0":360.43847786458275,"a1":371.77181119791607,"o":[399.45,217.05],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[384.62,231.76],"edgeE":[0,1.188],"stage":2,"dev":1},{"a0":371.77181119791607,"a1":383.1051445312494,"o":[399.45,230.51],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[384.62,245.22],"edgeE":[0,1.188],"stage":2,"dev":1},{"a0":383.1051445312494,"a1":395.0851445312494,"o":[399.45,243.98],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[384.62,258.69],"edgeE":[0,1.188],"stage":2,"dev":1},{"a0":395.0851445312494,"a1":407.0651445312494,"o":[399.45,258.21],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[384.62,272.92],"edgeE":[0,1.188],"stage":2,"dev":1},{"a0":407.0651445312494,"a1":419.04514453124943,"o":[399.45,272.44],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[384.62,287.15],"edgeE":[0,1.188],"stage":2,"dev":1},{"a0":419.04514453124943,"a1":431.02514453124945,"o":[399.45,286.67],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[384.62,301.38],"edgeE":[0,1.188],"stage":2,"dev":1},{"a0":431.02514453124945,"a1":443.00514453124947,"o":[399.45,300.91],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[384.62,315.62],"edgeE":[0,1.188],"stage":2,"dev":1},{"a0":443.00514453124947,"a1":447.70408745117135,"o":[399.45,315.14],"ea":[0.1581,1.1955],"ey":[-0.6014,0.6165],"edgeO":[384.62,329.85],"edgeE":[0.1609,1.2171],"stage":2,"dev":1},{"a0":447.70408745117135,"a1":452.4030303710932,"o":[400.2,320.75],"ea":[0.4634,1.1911],"ey":[-0.6014,0.6165],"edgeO":[385.37,335.57],"edgeE":[0.4718,1.2126],"stage":2,"dev":1},{"a0":452.4030303710932,"a1":457.1019732910151,"o":[402.37,326.35],"ea":[0.7372,1.1055],"ey":[-0.6014,0.6165],"edgeO":[387.59,341.27],"edgeE":[0.7506,1.1256],"stage":2,"dev":1},{"a0":457.1019732910151,"a1":461.800916210937,"o":[405.84,331.55],"ea":[0.9608,0.9447],"ey":[-0.6014,0.6165],"edgeO":[391.12,346.56],"edgeE":[0.9782,0.9618],"stage":2,"dev":1},{"a0":461.800916210937,"a1":466.49985913085885,"o":[410.35,335.99],"ea":[1.1189,0.7194],"ey":[-0.6014,0.6165],"edgeO":[395.71,351.07],"edgeE":[1.1391,0.7324],"stage":2,"dev":1},{"a0":466.49985913085885,"a1":471.1988020507807,"o":[415.61,339.37],"ea":[1.2007,0.4451],"ey":[-0.6014,0.6165],"edgeO":[401.06,354.52],"edgeE":[1.2224,0.4532],"stage":2,"dev":1},{"a0":471.1988020507807,"a1":475.89774497070255,"o":[421.25,341.46],"ea":[1.2007,0.1405],"ey":[-0.6014,0.6165],"edgeO":[406.81,356.65],"edgeE":[1.2224,0.143],"stage":2,"dev":1},{"a0":475.89774497070255,"a1":480.5966878906244,"o":[426.9,342.12],"ea":[1.1189,-0.1737],"ey":[-0.6014,0.6165],"edgeO":[412.55,357.32],"edgeE":[1.1391,-0.1768],"stage":2,"dev":1},{"a0":480.5966878906244,"a1":485.2956308105463,"o":[432.15,341.3],"ea":[0.9608,-0.4761],"ey":[-0.6014,0.6165],"edgeO":[417.91,356.49],"edgeE":[0.9782,-0.4847],"stage":2,"dev":1},{"a0":485.2956308105463,"a1":489.9945737304681,"o":[436.67,339.06],"ea":[0.7372,-0.746],"ey":[-0.6014,0.6165],"edgeO":[422.5,354.21],"edgeE":[0.7506,-0.7595],"stage":2,"dev":1},{"a0":489.9945737304681,"a1":494.69351665039,"o":[440.81,336.11],"ea":[0.4802,-1],"ey":[-0.6014,0.6165],"edgeO":[426.03,350.64],"edgeE":[0.4718,-0.9825],"stage":2,"dev":1},{"a0":494.69351665039,"a1":499.39245957031187,"o":[443.07,331.41],"ea":[0.1638,-1.1588],"ey":[-0.6014,0.6165],"edgeO":[428.25,346.02],"edgeE":[0.1609,-1.1386],"stage":2,"dev":1},{"a0":499.39245957031187,"a1":511.3724595703119,"o":[443.84,325.96],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[429,340.67],"edgeE":[0,-1.188],"stage":2,"dev":1},{"a0":511.3724595703119,"a1":523.3524595703119,"o":[443.84,311.73],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[429,326.44],"edgeE":[0,-1.188],"stage":2,"dev":1},{"a0":523.3524595703119,"a1":535.3324595703119,"o":[443.84,297.5],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[429,312.21],"edgeE":[0,-1.188],"stage":2,"dev":1},{"a0":535.3324595703119,"a1":547.312459570312,"o":[443.84,283.26],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[429,297.98],"edgeE":[0,-1.188],"stage":2,"dev":1},{"a0":547.312459570312,"a1":559.292459570312,"o":[443.84,269.03],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[429,283.74],"edgeE":[0,-1.188],"stage":2,"dev":1},{"a0":559.292459570312,"a1":570.6257929036453,"o":[443.84,254.8],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[429,269.51],"edgeE":[0,-1.188],"stage":2,"dev":1},{"a0":570.6257929036453,"a1":581.9591262369786,"o":[443.84,241.34],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[429,256.05],"edgeE":[0,-1.188],"stage":2,"dev":1},{"a0":581.9591262369786,"a1":593.292459570312,"o":[443.84,227.87],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[429,242.58],"edgeE":[0,-1.188],"stage":2,"dev":1},{"a0":593.292459570312,"a1":596.4250881835932,"o":[443.84,214.41],"ea":[0.1566,-1.1082],"ey":[-0.6014,0.6165],"edgeO":[429,229.12],"edgeE":[0.1609,-1.1386],"stage":2,"dev":1},{"a0":596.4250881835932,"a1":599.5577167968744,"o":[444.33,210.94],"ea":[0.4593,-0.9563],"ey":[-0.6014,0.6165],"edgeO":[429.51,225.55],"edgeE":[0.4718,-0.9825],"stage":2,"dev":1},{"a0":599.5577167968744,"a1":602.6903454101556,"o":[445.09,207.39],"ea":[0.7706,-0.7797],"ey":[-0.6014,0.6165],"edgeO":[430.98,222.48],"edgeE":[0.7506,-0.7595],"stage":2,"dev":1},{"a0":602.6903454101556,"a1":605.8229740234368,"o":[447.5,204.95],"ea":[1.0043,-0.4976],"ey":[-0.6014,0.6165],"edgeO":[433.34,220.1],"edgeE":[0.9782,-0.4847],"stage":2,"dev":1},{"a0":605.8229740234368,"a1":608.955602636718,"o":[450.65,203.39],"ea":[1.1695,-0.1816],"ey":[-0.6014,0.6165],"edgeO":[436.4,218.58],"edgeE":[1.1391,-0.1768],"stage":2,"dev":1},{"a0":608.955602636718,"a1":612.0882312499992,"o":[454.31,202.82],"ea":[1.255,0.1469],"ey":[-0.6014,0.6165],"edgeO":[439.97,218.02],"edgeE":[1.2224,0.143],"stage":2,"dev":1},{"a0":612.0882312499992,"a1":615.2208598632805,"o":[458.24,203.28],"ea":[1.255,0.4653],"ey":[-0.6014,0.6165],"edgeO":[443.8,218.47],"edgeE":[1.2224,0.4532],"stage":3,"dev":1},{"a0":615.2208598632805,"a1":618.3534884765617,"o":[462.17,204.74],"ea":[1.1695,0.752],"ey":[-0.6014,0.6165],"edgeO":[447.63,219.89],"edgeE":[1.1391,0.7324],"stage":3,"dev":1},{"a0":618.3534884765617,"a1":621.4861170898429,"o":[465.84,207.1],"ea":[1.0043,0.9874],"ey":[-0.6014,0.6165],"edgeO":[451.2,222.19],"edgeE":[0.9782,0.9618],"stage":3,"dev":1},{"a0":621.4861170898429,"a1":624.6187457031241,"o":[468.98,210.19],"ea":[0.7706,1.1556],"ey":[-0.6014,0.6165],"edgeO":[454.26,225.2],"edgeE":[0.7506,1.1256],"stage":3,"dev":1},{"a0":624.6187457031241,"a1":627.7513743164053,"o":[471.4,213.81],"ea":[0.4844,1.245],"ey":[-0.6014,0.6165],"edgeO":[456.61,228.72],"edgeE":[0.4718,1.2126],"stage":3,"dev":1},{"a0":627.7513743164053,"a1":630.8840029296865,"o":[472.91,217.71],"ea":[0.1652,1.2495],"ey":[-0.6014,0.6165],"edgeO":[458.09,232.52],"edgeE":[0.1609,1.2171],"stage":3,"dev":1},{"a0":630.8840029296865,"a1":642.2173362630199,"o":[473.43,221.62],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[458.59,236.34],"edgeE":[0,1.188],"stage":3,"dev":1},{"a0":642.2173362630199,"a1":653.5506695963531,"o":[473.43,235.09],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[458.59,249.8],"edgeE":[0,1.188],"stage":3,"dev":1},{"a0":653.5506695963531,"a1":664.8840029296865,"o":[473.43,248.55],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[458.59,263.26],"edgeE":[0,1.188],"stage":3,"dev":1},{"a0":664.8840029296865,"a1":676.8640029296865,"o":[473.43,262.02],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[458.59,276.73],"edgeE":[0,1.188],"stage":3,"dev":1},{"a0":676.8640029296865,"a1":688.8440029296866,"o":[473.43,276.25],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[458.59,290.96],"edgeE":[0,1.188],"stage":3,"dev":1},{"a0":688.8440029296866,"a1":700.8240029296866,"o":[473.43,290.48],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[458.59,305.19],"edgeE":[0,1.188],"stage":3,"dev":1},{"a0":700.8240029296866,"a1":712.8040029296866,"o":[473.43,304.71],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[458.59,319.43],"edgeE":[0,1.188],"stage":3,"dev":1},{"a0":712.8040029296866,"a1":724.7840029296866,"o":[473.43,318.95],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[458.59,333.66],"edgeE":[0,1.188],"stage":3,"dev":1},{"a0":724.7840029296866,"a1":729.4829458496084,"o":[473.43,333.18],"ea":[0.1581,1.1955],"ey":[-0.6014,0.6165],"edgeO":[458.59,347.89],"edgeE":[0.1609,1.2171],"stage":3,"dev":1},{"a0":729.4829458496084,"a1":734.1818887695302,"o":[474.17,338.8],"ea":[0.4634,1.1911],"ey":[-0.6014,0.6165],"edgeO":[459.35,353.61],"edgeE":[0.4718,1.2126],"stage":3,"dev":1},{"a0":734.1818887695302,"a1":738.8808316894521,"o":[476.35,344.39],"ea":[0.7372,1.1055],"ey":[-0.6014,0.6165],"edgeO":[461.57,359.31],"edgeE":[0.7506,1.1256],"stage":3,"dev":1},{"a0":738.8808316894521,"a1":743.5797746093739,"o":[479.82,349.59],"ea":[0.9608,0.9447],"ey":[-0.6014,0.6165],"edgeO":[465.09,364.6],"edgeE":[0.9782,0.9618],"stage":3,"dev":1},{"a0":743.5797746093739,"a1":748.2787175292957,"o":[484.33,354.03],"ea":[1.1189,0.7194],"ey":[-0.6014,0.6165],"edgeO":[469.69,369.12],"edgeE":[1.1391,0.7324],"stage":3,"dev":1},{"a0":748.2787175292957,"a1":752.9776604492175,"o":[489.59,357.41],"ea":[1.2007,0.4451],"ey":[-0.6014,0.6165],"edgeO":[475.04,372.56],"edgeE":[1.2224,0.4532],"stage":3,"dev":1},{"a0":752.9776604492175,"a1":757.6766033691393,"o":[495.23,359.5],"ea":[1.2007,0.1405],"ey":[-0.6014,0.6165],"edgeO":[480.79,374.69],"edgeE":[1.2224,0.143],"stage":3,"dev":1},{"a0":757.6766033691393,"a1":762.3755462890612,"o":[500.87,360.16],"ea":[1.1189,-0.1737],"ey":[-0.6014,0.6165],"edgeO":[486.53,375.36],"edgeE":[1.1391,-0.1768],"stage":3,"dev":1},{"a0":762.3755462890612,"a1":767.074489208983,"o":[506.13,359.34],"ea":[0.9608,-0.4761],"ey":[-0.6014,0.6165],"edgeO":[491.88,374.53],"edgeE":[0.9782,-0.4847],"stage":3,"dev":1},{"a0":767.074489208983,"a1":771.7734321289048,"o":[510.64,357.11],"ea":[0.7372,-0.746],"ey":[-0.6014,0.6165],"edgeO":[496.48,372.25],"edgeE":[0.7506,-0.7595],"stage":3,"dev":1},{"a0":771.7734321289048,"a1":776.4723750488266,"o":[514.79,354.15],"ea":[0.4802,-1],"ey":[-0.6014,0.6165],"edgeO":[500.01,368.68],"edgeE":[0.4718,-0.9825],"stage":3,"dev":1},{"a0":776.4723750488266,"a1":781.1713179687484,"o":[517.05,349.45],"ea":[0.1638,-1.1588],"ey":[-0.6014,0.6165],"edgeO":[502.22,364.06],"edgeE":[0.1609,-1.1386],"stage":3,"dev":1},{"a0":781.1713179687484,"a1":793.1513179687485,"o":[517.82,344],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[502.98,358.71],"edgeE":[0,-1.188],"stage":3,"dev":1},{"a0":793.1513179687485,"a1":805.1313179687485,"o":[517.82,329.77],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[502.98,344.48],"edgeE":[0,-1.188],"stage":3,"dev":1},{"a0":805.1313179687485,"a1":817.1113179687485,"o":[517.82,315.54],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[502.98,330.25],"edgeE":[0,-1.188],"stage":3,"dev":1},{"a0":817.1113179687485,"a1":829.0913179687485,"o":[517.82,301.31],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[502.98,316.02],"edgeE":[0,-1.188],"stage":3,"dev":1},{"a0":829.0913179687485,"a1":841.0713179687485,"o":[517.82,287.07],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[502.98,301.78],"edgeE":[0,-1.188],"stage":3,"dev":1},{"a0":841.0713179687485,"a1":852.4046513020819,"o":[517.82,272.84],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[502.98,287.55],"edgeE":[0,-1.188],"stage":3,"dev":1},{"a0":852.4046513020819,"a1":863.7379846354152,"o":[517.82,259.38],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[502.98,274.09],"edgeE":[0,-1.188],"stage":3,"dev":1},{"a0":863.7379846354152,"a1":875.0713179687485,"o":[517.82,245.91],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[502.98,260.62],"edgeE":[0,-1.188],"stage":3,"dev":1},{"a0":875.0713179687485,"a1":878.2039465820297,"o":[517.82,232.45],"ea":[0.1566,-1.1082],"ey":[-0.6014,0.6165],"edgeO":[502.98,247.16],"edgeE":[0.1609,-1.1386],"stage":3,"dev":1},{"a0":878.2039465820297,"a1":881.336575195311,"o":[518.31,228.98],"ea":[0.4593,-0.9563],"ey":[-0.6014,0.6165],"edgeO":[503.48,243.59],"edgeE":[0.4718,-0.9825],"stage":3,"dev":1},{"a0":881.336575195311,"a1":884.4692038085922,"o":[519.06,225.43],"ea":[0.7706,-0.7797],"ey":[-0.6014,0.6165],"edgeO":[504.96,240.52],"edgeE":[0.7506,-0.7595],"stage":3,"dev":1},{"a0":884.4692038085922,"a1":887.6018324218734,"o":[521.48,222.99],"ea":[1.0043,-0.4976],"ey":[-0.6014,0.6165],"edgeO":[507.31,238.14],"edgeE":[0.9782,-0.4847],"stage":3,"dev":1},{"a0":887.6018324218734,"a1":890.7344610351546,"o":[524.62,221.43],"ea":[1.1695,-0.1816],"ey":[-0.6014,0.6165],"edgeO":[510.38,236.62],"edgeE":[1.1391,-0.1768],"stage":3,"dev":1},{"a0":890.7344610351546,"a1":893.8670896484358,"o":[528.29,220.86],"ea":[1.255,0.1469],"ey":[-0.6014,0.6165],"edgeO":[513.95,236.06],"edgeE":[1.2224,0.143],"stage":3,"dev":1},{"a0":893.8670896484358,"a1":896.999718261717,"o":[532.22,221.32],"ea":[1.255,0.4653],"ey":[-0.6014,0.6165],"edgeO":[517.77,236.51],"edgeE":[1.2224,0.4532],"stage":4,"dev":1},{"a0":896.999718261717,"a1":900.1323468749982,"o":[536.15,222.78],"ea":[1.1695,0.752],"ey":[-0.6014,0.6165],"edgeO":[521.6,237.93],"edgeE":[1.1391,0.7324],"stage":4,"dev":1},{"a0":900.1323468749982,"a1":903.2649754882794,"o":[539.81,225.14],"ea":[1.0043,0.9874],"ey":[-0.6014,0.6165],"edgeO":[525.17,240.23],"edgeE":[0.9782,0.9618],"stage":4,"dev":1},{"a0":903.2649754882794,"a1":906.3976041015607,"o":[542.96,228.23],"ea":[0.7706,1.1556],"ey":[-0.6014,0.6165],"edgeO":[528.24,243.24],"edgeE":[0.7506,1.1256],"stage":4,"dev":1},{"a0":906.3976041015607,"a1":909.5302327148419,"o":[545.37,231.85],"ea":[0.4844,1.245],"ey":[-0.6014,0.6165],"edgeO":[530.59,246.77],"edgeE":[0.4718,1.2126],"stage":4,"dev":1},{"a0":909.5302327148419,"a1":912.6628613281231,"o":[546.89,235.75],"ea":[0.1652,1.2495],"ey":[-0.6014,0.6165],"edgeO":[532.07,250.56],"edgeE":[0.1609,1.2171],"stage":4,"dev":1},{"a0":912.6628613281231,"a1":923.9961946614565,"o":[547.41,239.66],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[532.57,254.38],"edgeE":[0,1.188],"stage":4,"dev":1},{"a0":923.9961946614565,"a1":935.3295279947897,"o":[547.41,253.13],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[532.57,267.84],"edgeE":[0,1.188],"stage":4,"dev":1},{"a0":935.3295279947897,"a1":946.6628613281231,"o":[547.41,266.59],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[532.57,281.3],"edgeE":[0,1.188],"stage":4,"dev":1},{"a0":946.6628613281231,"a1":958.6428613281231,"o":[547.41,280.06],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[532.57,294.77],"edgeE":[0,1.188],"stage":4,"dev":1},{"a0":958.6428613281231,"a1":970.6228613281231,"o":[547.41,294.29],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[532.57,309],"edgeE":[0,1.188],"stage":4,"dev":1},{"a0":970.6228613281231,"a1":982.6028613281231,"o":[547.41,308.52],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[532.57,323.23],"edgeE":[0,1.188],"stage":4,"dev":1},{"a0":982.6028613281231,"a1":994.5828613281232,"o":[547.41,322.75],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[532.57,337.47],"edgeE":[0,1.188],"stage":4,"dev":1},{"a0":994.5828613281232,"a1":1006.5628613281232,"o":[547.41,336.99],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[532.57,351.7],"edgeE":[0,1.188],"stage":4,"dev":1},{"a0":1006.5628613281232,"a1":1011.261804248045,"o":[547.41,351.22],"ea":[0.1581,1.1955],"ey":[-0.6014,0.6165],"edgeO":[532.57,365.93],"edgeE":[0.1609,1.2171],"stage":4,"dev":1},{"a0":1011.261804248045,"a1":1015.9607471679668,"o":[548.15,356.84],"ea":[0.4634,1.1911],"ey":[-0.6014,0.6165],"edgeO":[533.33,371.65],"edgeE":[0.4718,1.2126],"stage":4,"dev":1},{"a0":1015.9607471679668,"a1":1020.6596900878886,"o":[550.33,362.43],"ea":[0.7372,1.1055],"ey":[-0.6014,0.6165],"edgeO":[535.54,377.35],"edgeE":[0.7506,1.1256],"stage":4,"dev":1},{"a0":1020.6596900878886,"a1":1025.3586330078106,"o":[553.79,367.63],"ea":[0.9608,0.9447],"ey":[-0.6014,0.6165],"edgeO":[539.07,382.64],"edgeE":[0.9782,0.9618],"stage":4,"dev":1},{"a0":1025.3586330078106,"a1":1030.0575759277324,"o":[558.31,372.07],"ea":[1.1189,0.7194],"ey":[-0.6014,0.6165],"edgeO":[543.67,387.16],"edgeE":[1.1391,0.7324],"stage":4,"dev":1},{"a0":1030.0575759277324,"a1":1034.7565188476542,"o":[563.57,375.45],"ea":[1.2007,0.4451],"ey":[-0.6014,0.6165],"edgeO":[549.02,390.6],"edgeE":[1.2224,0.4532],"stage":4,"dev":1},{"a0":1034.7565188476542,"a1":1039.455461767576,"o":[569.21,377.54],"ea":[1.2007,0.1405],"ey":[-0.6014,0.6165],"edgeO":[554.76,392.73],"edgeE":[1.2224,0.143],"stage":4,"dev":1},{"a0":1039.455461767576,"a1":1044.1544046874978,"o":[574.85,378.2],"ea":[1.1189,-0.1737],"ey":[-0.6014,0.6165],"edgeO":[560.51,393.4],"edgeE":[1.1391,-0.1768],"stage":4,"dev":1},{"a0":1044.1544046874978,"a1":1048.8533476074197,"o":[580.11,377.38],"ea":[0.9608,-0.4761],"ey":[-0.6014,0.6165],"edgeO":[565.86,392.57],"edgeE":[0.9782,-0.4847],"stage":4,"dev":1},{"a0":1048.8533476074197,"a1":1053.5522905273415,"o":[584.62,375.15],"ea":[0.7372,-0.746],"ey":[-0.6014,0.6165],"edgeO":[570.46,390.29],"edgeE":[0.7506,-0.7595],"stage":4,"dev":1},{"a0":1053.5522905273415,"a1":1058.2512334472633,"o":[588.77,372.19],"ea":[0.4802,-1],"ey":[-0.6014,0.6165],"edgeO":[573.98,386.72],"edgeE":[0.4718,-0.9825],"stage":4,"dev":1},{"a0":1058.2512334472633,"a1":1062.9501763671851,"o":[591.03,367.49],"ea":[0.1638,-1.1588],"ey":[-0.6014,0.6165],"edgeO":[576.2,382.11],"edgeE":[0.1609,-1.1386],"stage":4,"dev":1},{"a0":1062.9501763671851,"a1":1074.9301763671851,"o":[591.8,362.04],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[576.96,376.75],"edgeE":[0,-1.188],"stage":4,"dev":1},{"a0":1074.9301763671851,"a1":1086.9101763671852,"o":[591.8,347.81],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[576.96,362.52],"edgeE":[0,-1.188],"stage":4,"dev":1},{"a0":1086.9101763671852,"a1":1098.8901763671852,"o":[591.8,333.58],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[576.96,348.29],"edgeE":[0,-1.188],"stage":4,"dev":1},{"a0":1098.8901763671852,"a1":1110.8701763671852,"o":[591.8,319.35],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[576.96,334.06],"edgeE":[0,-1.188],"stage":4,"dev":1},{"a0":1110.8701763671852,"a1":1122.8501763671852,"o":[591.8,305.11],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[576.96,319.83],"edgeE":[0,-1.188],"stage":4,"dev":1},{"a0":1122.8501763671852,"a1":1134.1835097005185,"o":[591.8,290.88],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[576.96,305.59],"edgeE":[0,-1.188],"stage":4,"dev":1},{"a0":1134.1835097005185,"a1":1145.5168430338517,"o":[591.8,277.42],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[576.96,292.13],"edgeE":[0,-1.188],"stage":4,"dev":1},{"a0":1145.5168430338517,"a1":1156.850176367185,"o":[591.8,263.95],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[576.96,278.67],"edgeE":[0,-1.188],"stage":4,"dev":1},{"a0":1156.850176367185,"a1":1159.9828049804662,"o":[591.8,250.49],"ea":[0.1566,-1.1082],"ey":[-0.6014,0.6165],"edgeO":[576.96,265.2],"edgeE":[0.1609,-1.1386],"stage":4,"dev":1},{"a0":1159.9828049804662,"a1":1163.1154335937474,"o":[592.29,247.02],"ea":[0.4593,-0.9563],"ey":[-0.6014,0.6165],"edgeO":[577.46,261.63],"edgeE":[0.4718,-0.9825],"stage":4,"dev":1},{"a0":1163.1154335937474,"a1":1166.2480622070286,"o":[593.04,243.48],"ea":[0.7706,-0.7797],"ey":[-0.6014,0.6165],"edgeO":[578.94,258.56],"edgeE":[0.7506,-0.7595],"stage":4,"dev":1},{"a0":1166.2480622070286,"a1":1169.3806908203098,"o":[595.46,241.03],"ea":[1.0043,-0.4976],"ey":[-0.6014,0.6165],"edgeO":[581.29,256.18],"edgeE":[0.9782,-0.4847],"stage":4,"dev":1},{"a0":1169.3806908203098,"a1":1172.513319433591,"o":[598.6,239.47],"ea":[1.1695,-0.1816],"ey":[-0.6014,0.6165],"edgeO":[584.35,254.66],"edgeE":[1.1391,-0.1768],"stage":4,"dev":1},{"a0":1172.513319433591,"a1":1175.6459480468723,"o":[602.27,238.9],"ea":[1.255,0.1469],"ey":[-0.6014,0.6165],"edgeO":[587.92,254.1],"edgeE":[1.2224,0.143],"stage":4,"dev":1},{"a0":1175.6459480468723,"a1":1178.7785766601535,"o":[606.2,239.36],"ea":[1.255,0.4653],"ey":[-0.6014,0.6165],"edgeO":[591.75,254.55],"edgeE":[1.2224,0.4532],"stage":5,"dev":1},{"a0":1178.7785766601535,"a1":1181.9112052734347,"o":[610.13,240.82],"ea":[1.1695,0.752],"ey":[-0.6014,0.6165],"edgeO":[595.58,255.97],"edgeE":[1.1391,0.7324],"stage":5,"dev":1},{"a0":1181.9112052734347,"a1":1185.043833886716,"o":[613.79,243.18],"ea":[1.0043,0.9874],"ey":[-0.6014,0.6165],"edgeO":[599.15,258.27],"edgeE":[0.9782,0.9618],"stage":5,"dev":1},{"a0":1185.043833886716,"a1":1188.1764624999971,"o":[616.94,246.27],"ea":[0.7706,1.1556],"ey":[-0.6014,0.6165],"edgeO":[602.21,261.28],"edgeE":[0.7506,1.1256],"stage":5,"dev":1},{"a0":1188.1764624999971,"a1":1191.3090911132783,"o":[619.35,249.89],"ea":[0.4844,1.245],"ey":[-0.6014,0.6165],"edgeO":[604.57,264.81],"edgeE":[0.4718,1.2126],"stage":5,"dev":1},{"a0":1191.3090911132783,"a1":1194.4417197265595,"o":[620.87,253.79],"ea":[0.1652,1.2495],"ey":[-0.6014,0.6165],"edgeO":[606.04,268.6],"edgeE":[0.1609,1.2171],"stage":5,"dev":1},{"a0":1194.4417197265595,"a1":1205.4417197265595,"o":[621.39,257.71],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[606.55,272.42],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1205.4417197265595,"a1":1216.4417197265595,"o":[621.39,270.77],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[606.55,285.49],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1216.4417197265595,"a1":1227.4417197265595,"o":[621.39,283.84],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[606.55,298.55],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1227.4417197265595,"a1":1238.4417197265595,"o":[621.39,296.91],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[606.55,311.62],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1238.4417197265595,"a1":1249.4417197265595,"o":[621.39,309.98],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[606.55,324.69],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1249.4417197265595,"a1":1260.4417197265595,"o":[621.39,323.05],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[606.55,337.76],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1260.4417197265595,"a1":1271.4417197265595,"o":[621.39,336.11],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[606.55,350.83],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1271.4417197265595,"a1":1282.4417197265595,"o":[621.39,349.18],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[606.55,363.89],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1282.4417197265595,"a1":1285.5743483398408,"o":[621.39,362.25],"ea":[0.1566,1.1846],"ey":[-0.6014,0.6165],"edgeO":[606.55,376.96],"edgeE":[0.1609,1.2171],"stage":5,"dev":1},{"a0":1285.5743483398408,"a1":1288.706976953122,"o":[621.88,365.96],"ea":[0.4593,1.1803],"ey":[-0.6014,0.6165],"edgeO":[607.05,380.77],"edgeE":[0.4718,1.2126],"stage":5,"dev":1},{"a0":1288.706976953122,"a1":1291.8396055664032,"o":[623.32,369.66],"ea":[0.7306,1.0955],"ey":[-0.6014,0.6165],"edgeO":[608.53,384.57],"edgeE":[0.7506,1.1256],"stage":5,"dev":1},{"a0":1291.8396055664032,"a1":1294.9722341796844,"o":[625.6,373.09],"ea":[0.9521,0.9361],"ey":[-0.6014,0.6165],"edgeO":[610.88,388.1],"edgeE":[0.9782,0.9618],"stage":5,"dev":1},{"a0":1294.9722341796844,"a1":1298.1048627929656,"o":[628.59,376.02],"ea":[1.1087,0.7129],"ey":[-0.6014,0.6165],"edgeO":[613.95,391.11],"edgeE":[1.1391,0.7324],"stage":5,"dev":1},{"a0":1298.1048627929656,"a1":1301.2374914062468,"o":[632.06,378.26],"ea":[1.1898,0.4411],"ey":[-0.6014,0.6165],"edgeO":[617.51,393.41],"edgeE":[1.2224,0.4532],"stage":5,"dev":1},{"a0":1301.2374914062468,"a1":1304.370120019528,"o":[635.79,379.64],"ea":[1.1898,0.1392],"ey":[-0.6014,0.6165],"edgeO":[621.34,394.83],"edgeE":[1.2224,0.143],"stage":5,"dev":1},{"a0":1304.370120019528,"a1":1307.5027486328092,"o":[639.52,380.07],"ea":[1.1087,-0.1721],"ey":[-0.6014,0.6165],"edgeO":[625.17,395.27],"edgeE":[1.1391,-0.1768],"stage":5,"dev":1},{"a0":1307.5027486328092,"a1":1310.6353772460905,"o":[642.99,379.53],"ea":[0.9521,-0.4717],"ey":[-0.6014,0.6165],"edgeO":[628.74,394.72],"edgeE":[0.9782,-0.4847],"stage":5,"dev":1},{"a0":1310.6353772460905,"a1":1313.7680058593717,"o":[645.97,378.06],"ea":[0.7306,-0.7392],"ey":[-0.6014,0.6165],"edgeO":[631.81,393.2],"edgeE":[0.7506,-0.7595],"stage":5,"dev":1},{"a0":1313.7680058593717,"a1":1316.9006344726529,"o":[648.94,376.29],"ea":[0.4844,-1.0087],"ey":[-0.6014,0.6165],"edgeO":[634.16,390.82],"edgeE":[0.4718,-0.9825],"stage":5,"dev":1},{"a0":1316.9006344726529,"a1":1320.033263085934,"o":[650.46,373.13],"ea":[0.1652,-1.169],"ey":[-0.6014,0.6165],"edgeO":[635.63,387.74],"edgeE":[0.1609,-1.1386],"stage":5,"dev":1},{"a0":1320.033263085934,"a1":1331.033263085934,"o":[650.98,369.47],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[636.14,384.18],"edgeE":[0,-1.188],"stage":5,"dev":1},{"a0":1331.033263085934,"a1":1342.033263085934,"o":[650.98,356.4],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[636.14,371.11],"edgeE":[0,-1.188],"stage":5,"dev":1},{"a0":1342.033263085934,"a1":1353.033263085934,"o":[650.98,343.33],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[636.14,358.04],"edgeE":[0,-1.188],"stage":5,"dev":1},{"a0":1353.033263085934,"a1":1364.033263085934,"o":[650.98,330.26],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[636.14,344.97],"edgeE":[0,-1.188],"stage":5,"dev":1},{"a0":1364.033263085934,"a1":1375.033263085934,"o":[650.98,317.19],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[636.14,331.91],"edgeE":[0,-1.188],"stage":5,"dev":1},{"a0":1375.033263085934,"a1":1386.033263085934,"o":[650.98,304.13],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[636.14,318.84],"edgeE":[0,-1.188],"stage":5,"dev":1},{"a0":1386.033263085934,"a1":1397.033263085934,"o":[650.98,291.06],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[636.14,305.77],"edgeE":[0,-1.188],"stage":5,"dev":1},{"a0":1397.033263085934,"a1":1408.033263085934,"o":[650.98,277.99],"ea":[0,-1.188],"ey":[-0.6014,0.6165],"edgeO":[636.14,292.7],"edgeE":[0,-1.188],"stage":5,"dev":1},{"a0":1408.033263085934,"a1":1411.1658916992153,"o":[650.98,264.92],"ea":[0.1566,-1.1082],"ey":[-0.6014,0.6165],"edgeO":[636.14,279.63],"edgeE":[0.1609,-1.1386],"stage":5,"dev":1},{"a0":1411.1658916992153,"a1":1414.2985203124965,"o":[651.47,261.45],"ea":[0.4593,-0.9563],"ey":[-0.6014,0.6165],"edgeO":[636.64,276.07],"edgeE":[0.4718,-0.9825],"stage":5,"dev":1},{"a0":1414.2985203124965,"a1":1417.4311489257777,"o":[652.22,257.91],"ea":[0.7706,-0.7797],"ey":[-0.6014,0.6165],"edgeO":[638.12,272.99],"edgeE":[0.7506,-0.7595],"stage":5,"dev":1},{"a0":1417.4311489257777,"a1":1420.563777539059,"o":[654.64,255.46],"ea":[1.0043,-0.4976],"ey":[-0.6014,0.6165],"edgeO":[640.47,270.61],"edgeE":[0.9782,-0.4847],"stage":5,"dev":1},{"a0":1420.563777539059,"a1":1423.6964061523402,"o":[657.78,253.91],"ea":[1.1695,-0.1816],"ey":[-0.6014,0.6165],"edgeO":[643.54,269.09],"edgeE":[1.1391,-0.1768],"stage":5,"dev":1},{"a0":1423.6964061523402,"a1":1426.8290347656214,"o":[661.45,253.34],"ea":[1.255,0.1469],"ey":[-0.6014,0.6165],"edgeO":[647.11,268.54],"edgeE":[1.2224,0.143],"stage":5,"dev":1},{"a0":1426.8290347656214,"a1":1429.9616633789026,"o":[665.38,253.8],"ea":[1.255,0.4653],"ey":[-0.6014,0.6165],"edgeO":[650.93,268.99],"edgeE":[1.2224,0.4532],"stage":5,"dev":1},{"a0":1429.9616633789026,"a1":1433.0942919921838,"o":[669.31,255.25],"ea":[1.1695,0.752],"ey":[-0.6014,0.6165],"edgeO":[654.76,270.41],"edgeE":[1.1391,0.7324],"stage":5,"dev":1},{"a0":1433.0942919921838,"a1":1436.226920605465,"o":[672.97,257.61],"ea":[1.0043,0.9874],"ey":[-0.6014,0.6165],"edgeO":[658.33,272.7],"edgeE":[0.9782,0.9618],"stage":5,"dev":1},{"a0":1436.226920605465,"a1":1439.3595492187462,"o":[676.12,260.7],"ea":[0.7706,1.1556],"ey":[-0.6014,0.6165],"edgeO":[661.4,275.71],"edgeE":[0.7506,1.1256],"stage":5,"dev":1},{"a0":1439.3595492187462,"a1":1442.4921778320274,"o":[678.53,264.32],"ea":[0.4844,1.245],"ey":[-0.6014,0.6165],"edgeO":[663.75,279.24],"edgeE":[0.4718,1.2126],"stage":5,"dev":1},{"a0":1442.4921778320274,"a1":1445.6248064453086,"o":[680.05,268.22],"ea":[0.1652,1.2495],"ey":[-0.6014,0.6165],"edgeO":[665.23,283.04],"edgeE":[0.1609,1.2171],"stage":5,"dev":1},{"a0":1445.6248064453086,"a1":1456.6248064453086,"o":[680.57,272.14],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[665.73,286.85],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1456.6248064453086,"a1":1467.6248064453086,"o":[680.57,285.21],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[665.73,299.92],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1467.6248064453086,"a1":1478.6248064453086,"o":[680.57,298.27],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[665.73,312.99],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1478.6248064453086,"a1":1489.6248064453086,"o":[680.57,311.34],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[665.73,326.05],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1489.6248064453086,"a1":1500.6248064453086,"o":[680.57,324.41],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[665.73,339.12],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1500.6248064453086,"a1":1511.6248064453086,"o":[680.57,337.48],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[665.73,352.19],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1511.6248064453086,"a1":1522.6248064453086,"o":[680.57,350.55],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[665.73,365.26],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1522.6248064453086,"a1":1533.6248064453086,"o":[680.57,363.61],"ea":[0,1.188],"ey":[-0.6014,0.6165],"edgeO":[665.73,378.33],"edgeE":[0,1.188],"stage":5,"dev":1},{"a0":1533.6248064453086,"a1":1536.7574350585899,"o":[680.57,376.68],"ea":[0.1566,1.1846],"ey":[-0.6014,0.6165],"edgeO":[665.73,391.39],"edgeE":[0.1609,1.2171],"stage":5,"dev":1},{"a0":1536.7574350585899,"a1":1539.890063671871,"o":[681.06,380.39],"ea":[0.4593,1.1803],"ey":[-0.6014,0.6165],"edgeO":[666.23,395.21],"edgeE":[0.4718,1.2126],"stage":5,"dev":1},{"a0":1539.890063671871,"a1":1543.0226922851523,"o":[682.5,384.09],"ea":[0.7306,1.0955],"ey":[-0.6014,0.6165],"edgeO":[667.71,399.01],"edgeE":[0.7506,1.1256],"stage":5,"dev":1},{"a0":1543.0226922851523,"a1":1546.1553208984335,"o":[684.79,387.52],"ea":[0.9521,0.9361],"ey":[-0.6014,0.6165],"edgeO":[670.06,402.53],"edgeE":[0.9782,0.9618],"stage":5,"dev":1},{"a0":1546.1553208984335,"a1":1549.2879495117147,"o":[687.77,390.46],"ea":[1.1087,0.7129],"ey":[-0.6014,0.6165],"edgeO":[673.13,405.54],"edgeE":[1.1391,0.7324],"stage":5,"dev":1},{"a0":1549.2879495117147,"a1":1552.420578124996,"o":[691.24,392.69],"ea":[1.1898,0.4411],"ey":[-0.6014,0.6165],"edgeO":[676.7,407.84],"edgeE":[1.2224,0.4532],"stage":5,"dev":1},{"a0":1552.420578124996,"a1":1562.9920066964246,"o":[694.97,394.07],"ea":[1.233,0.3007],"ey":[-0.6014,0.6165],"edgeO":[680.53,409.26],"edgeE":[1.233,0.3007],"stage":5,"dev":1},{"a0":1562.9920066964246,"a1":1573.563435267853,"o":[708,397.25],"ea":[1.233,0.3007],"ey":[-0.6014,0.6165],"edgeO":[693.56,412.44],"edgeE":[1.233,0.3007],"stage":5,"dev":1},{"a0":1573.563435267853,"a1":1584.1348638392817,"o":[721.04,400.43],"ea":[1.233,0.3007],"ey":[-0.6014,0.6165],"edgeO":[706.59,415.62],"edgeE":[1.233,0.3007],"stage":5,"dev":1},{"a0":1584.1348638392817,"a1":1594.7062924107104,"o":[734.07,403.61],"ea":[1.233,0.3007],"ey":[-0.6014,0.6165],"edgeO":[719.63,418.79],"edgeE":[1.233,0.3007],"stage":5,"dev":1},{"a0":1594.7062924107104,"a1":1605.277720982139,"o":[747.11,406.78],"ea":[1.233,0.3007],"ey":[-0.6014,0.6165],"edgeO":[732.66,421.97],"edgeE":[1.233,0.3007],"stage":5,"dev":1},{"a0":1605.277720982139,"a1":1615.8491495535677,"o":[760.14,409.96],"ea":[1.233,0.3007],"ey":[-0.6014,0.6165],"edgeO":[745.7,425.15],"edgeE":[1.233,0.3007],"stage":5,"dev":1},{"a0":1615.8491495535677,"a1":1626.4205781249962,"o":[773.17,413.14],"ea":[1.233,0.3007],"ey":[-0.6014,0.6165],"edgeO":[758.73,428.33],"edgeE":[1.233,0.3007],"stage":5,"dev":1}],"rollers":[{"c":[295.48,277.33],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2299},{"c":[306.09,279.91],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2299},{"c":[295.48,251.19],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2244},{"c":[306.09,253.78],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2244},{"c":[295.48,222.68],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2271},{"c":[306.09,225.27],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2271},{"c":[349.73,290.56],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2299},{"c":[360.34,293.14],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2299},{"c":[349.73,264.42],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2244},{"c":[360.34,267.01],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2244},{"c":[349.73,235.91],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2271},{"c":[360.34,238.5],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2271},{"c":[327.91,311.25],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":13.89,"spin":0.0455},{"c":[379.33,297.77],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.1932},{"c":[389.93,300.36],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.1932},{"c":[379.33,271.64],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2326},{"c":[389.93,274.22],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2326},{"c":[379.33,243.13],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2271},{"c":[389.93,245.71],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2271},{"c":[423.71,308.6],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.1932},{"c":[434.32,311.18],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.1932},{"c":[423.71,282.46],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2326},{"c":[434.32,285.05],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2326},{"c":[423.71,253.95],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2271},{"c":[434.32,256.54],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2271},{"c":[406.82,335.25],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":11.33,"spin":0.0556},{"c":[453.3,315.82],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.1932},{"c":[463.91,318.4],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.1932},{"c":[453.3,289.68],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2326},{"c":[463.91,292.26],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2326},{"c":[453.3,261.17],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2271},{"c":[463.91,263.75],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2271},{"c":[497.69,326.64],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.1932},{"c":[508.29,329.23],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.1932},{"c":[497.69,300.5],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2326},{"c":[508.29,303.09],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2326},{"c":[497.69,271.99],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2271},{"c":[508.29,274.58],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2271},{"c":[480.8,353.29],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":11.33,"spin":0.0556},{"c":[527.28,333.86],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.1932},{"c":[537.88,336.44],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.1932},{"c":[527.28,307.72],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2326},{"c":[537.88,310.31],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2326},{"c":[527.28,279.21],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2271},{"c":[537.88,281.79],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2271},{"c":[571.67,344.68],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.1932},{"c":[582.27,347.27],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.1932},{"c":[571.67,318.54],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2326},{"c":[582.27,321.13],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2326},{"c":[571.67,290.03],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2271},{"c":[582.27,292.62],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2271},{"c":[554.78,371.33],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":11.33,"spin":0.0556},{"c":[285.99,194.23],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":7.49,"spin":-0.0833},{"c":[369.83,214.67],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":7.49,"spin":-0.0833},{"c":[443.81,232.72],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":7.49,"spin":-0.0833},{"c":[517.79,250.76],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":7.49,"spin":-0.0833},{"c":[591.76,268.8],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":7.49,"spin":-0.0833},{"c":[621.36,380.56],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":7.49,"spin":0.0833},{"c":[650.95,283.23],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":7.49,"spin":-0.0833},{"c":[680.54,394.99],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":7.49,"spin":0.0833},{"c":[245.33,166.48],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":0.2326},{"c":[245.33,176.69],"ex":[1.233,0.3007],"ez":[0,-1.188],"rho":2.56,"spin":-0.2326}],"film":{"width":24,"pitch":3.3,"hole":[1.36,1.9],"holeRow":2.4,"frame":24.7,"gap":1.3,"frameInset":4},"stageX":[-164,-96,-36,24,84],"projection":{"origin":[495.41218849122714,454.73541237552536],"scale":1.084497240129638,"azimuth":64,"elevation":30},"operation":{"basis":{"o":[495.41,454.74],"x":[1.233,0.3007],"y":[-0.6014,0.6165],"z":[0,-1.188]},"tank":{"x0":-162,"x1":-98,"y0":16,"y1":26,"floor":66,"weir":150,"surfaceMin":84,"inletX":-120,"outletX":-154},"windows":{"temp":{"o":[207.91,279.91],"ex":[1.233,0.3007],"ez":[0,-1.188],"w":22,"h":9,"kind":"text"},"setpoint":{"o":[244.9,288.34],"ex":[1.233,0.3007],"ez":[0,-1.188],"w":18,"h":8,"kind":"text"},"flag-lid":{"o":[207.42,310.08],"ex":[1.233,0.3007],"ez":[0,-1.188],"w":11.800000000000011,"h":8,"kind":"text"},"flag-seal":{"o":[229.61,315.5],"ex":[1.233,0.3007],"ez":[0,-1.188],"w":11.800000000000011,"h":8,"kind":"text"},"flag-gate":{"o":[251.81,320.91],"ex":[1.233,0.3007],"ez":[0,-1.188],"w":11.800000000000011,"h":8,"kind":"text"},"dose":{"o":[376.83,453.97],"ex":[1.233,0.3007],"ez":[0,-1.188],"w":16,"h":7.5,"kind":"text"},"stock":{"o":[407.96,488.7],"ex":[1.233,0.3007],"ez":[0,-1.188],"w":8,"h":40,"kind":"level"},"waste":{"o":[475.74,509.64],"ex":[1.233,0.3007],"ez":[0,-1.188],"w":8,"h":17,"kind":"level"}}},"focus":{"all":[0,0,980,600],"loading":[58.87,13.39,387.59,237.3],"developer":[65.84,133.19,522.34,319.8],"replenishment":[106.85,187.88,653.66,400.2],"bleach":[182.51,119.55,476.28,291.6],"fix":[256.49,137.59,476.28,291.6],"rinse":[330.47,155.63,476.28,291.6],"dry":[431.84,163.49,536.06,328.2]}});
})();
