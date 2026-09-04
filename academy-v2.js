(() => {
  const replaceText = (from, to) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (node.nodeValue && node.nodeValue.includes(from)) {
        node.nodeValue = node.nodeValue.replace(from, to);
      }
    });
  };

  const copy = new Map([
    ['Website dẫn người học từ nhu cầu thật đến đúng lộ trình, thay vì bắt họ tự đoán nên học kỹ thuật, ánh sáng hay hậu kỳ trước.', 'Bạn được đánh giá xuất phát điểm, mục tiêu và thời gian trước khi chọn lộ trình. Không cần tự đoán nên học kỹ thuật, ánh sáng hay hậu kỳ trước.'],
    ['Bạn không cần biết tên khóa học. Chỉ cần biết mình muốn đi đến đâu.', 'Bắt đầu từ mục tiêu, không bắt đầu từ tên khóa học.'],
    ['Chọn theo đầu ra, không chọn theo số buổi.', 'Chọn theo đầu ra, mức đầu tư và kỹ năng bạn cần.'],
    ['Mỗi khóa đều phải nói rõ phù hợp với ai, học xong làm được gì, thời lượng, học phí và bước tiếp theo.', 'Mỗi lộ trình đều nói rõ phù hợp với ai, học xong làm được gì, thời lượng, học phí và bước tiếp theo.'],
    ['Không học để nhớ bài. Học để tự xử lý một buổi chụp.', 'Học bằng cách làm, sửa và làm lại.'],
    ['Một môi trường học phải cho thấy được tiêu chuẩn nghề nghiệp thật.', 'Tiêu chuẩn nghề nghiệp được nhìn thấy qua dự án thật.'],
    ['Academy cho người học nhìn thấy hệ hình ảnh Hang Đôi đang sản xuất ở ba nhóm: Hospitality, Product và F&B.', 'Học viên được tiếp cận cách Hang Đôi xây dựng hình ảnh thương mại ở ba nhóm: Hospitality, Product và F&B.'],
    ['Website phải chứng minh bằng tiến bộ thật, không chỉ bằng lời hứa.', 'Tiến bộ được đo bằng sản phẩm và khả năng tự xử lý buổi chụp.'],
    ['Case học viên nên cho thấy điểm bắt đầu, quá trình, lỗi đã vượt qua và sản phẩm đầu ra sau một khoảng thời gian cụ thể.', 'Mỗi hành trình bắt đầu từ một điểm khác nhau. Điều quan trọng là duy trì thực hành, nhận feedback và dần xác định hướng phù hợp.'],
    ['Thông tin cần rõ trước khi khách nhắn tin.', 'Những điều cần biết trước khi bắt đầu.'],
    ['FAQ tốt giúp loại bỏ rào cản và giảm số câu hỏi lặp lại cho đội tư vấn.', 'Các câu hỏi phổ biến về thiết bị, lịch học, hình thức học, học phí và cơ hội sau khóa.'],
    ['Demo redesign — UI/UX & conversion prototype', 'Đào tạo nhiếp ảnh thực hành tại Đà Nẵng'],
    ['Không sử dụng ảnh stock, ảnh AI hoặc ảnh WC. Tất cả được chọn từ các dự án của Hang Đôi.', 'Hình ảnh được chọn từ các dự án thương mại do Hang Đôi Production thực hiện.']
  ]);
  copy.forEach((to, from) => replaceText(from, to));

   const heroDesc = document.querySelector('.hero-desc');
  if (heroDesc) heroDesc.textContent = 'Lộ trình cá nhân hóa từ kỹ thuật, ánh sáng, hậu kỳ đến portfolio. Học trực tiếp tại studio và thực hành trên bối cảnh thật.';

  document.querySelectorAll('a.brand-official').forEach(a => {
    a.innerHTML = '<span class="academy-lockup"><span class="academy-ring"></span><span class="academy-lockup-text"><strong>HANG ĐÔI</strong><small>ACADEMY</small></span></span>';
  });

  const gallery = document.querySelector('#hoc-vien .story-gallery');
  if (gallery) {
    gallery.outerHTML = `
      <div class="story-journey" aria-label="Hành trình học của Công Tùng">
        <article class="journey-step">
          <span>01 / BẮT ĐẦU</span>
          <strong>Thích máy ảnh và ánh sáng, nhưng còn ngại giao tiếp.</strong>
          <p>Không cần có sẵn định hướng hoàn chỉnh. Bắt đầu bằng việc hiểu thiết bị và thử từng dạng bài tập.</p>
        </article>
        <article class="journey-step yellow">
          <span>02 / DUY TRÌ</span>
          <strong>Từ Đông Giang, đều đặn 3 buổi mỗi tuần.</strong>
          <p>Nhịp học ổn định giúp kỹ năng được hình thành qua thực hành, feedback và sửa lỗi liên tục.</p>
        </article>
        <article class="journey-step">
          <span>03 / ĐỊNH HƯỚNG</span>
          <strong>Dần nhận ra hứng thú với chụp sản phẩm.</strong>
          <p>Qua nhiều bài tập, Công Tùng thấy mình thích làm đẹp cho sản phẩm và tiếp tục thử thêm các hướng mới.</p>
        </article>
      </div>`;
  }

  const courses = document.querySelector('#khoa-hoc');
  if (courses && !document.querySelector('#chuong-trinh-chi-tiet')) {
    courses.insertAdjacentHTML('afterend', `
<section class="section curriculum-section" id="chuong-trinh-chi-tiet">
  <div class="container">
    <div class="section-head">
      <div><span class="eyebrow">Nội dung đào tạo</span><h2>Chi tiết từng lộ trình, không chỉ một danh sách tên khóa học.</h2></div>
      <p>Nội dung được điều chỉnh theo năng lực đầu vào, nhưng vẫn bám một khung rõ ràng để học viên biết mình sẽ học gì và tạo ra đầu ra nào.</p>
    </div>
    <div class="curriculum-list">
      <details class="curriculum-item" open>
        <summary><span class="curriculum-index">01</span><span class="curriculum-title"><small>NỀN TẢNG</small><strong>Nhiếp ảnh cơ bản</strong></span><span class="curriculum-meta">12 buổi · 6.680.000đ</span><span class="curriculum-toggle">+</span></summary>
        <div class="curriculum-content">
          <article><b>Giai đoạn 1</b><h3>Làm chủ máy ảnh</h3><p>Thông số phơi sáng, lấy nét, tiêu cự, cân bằng trắng và cách chọn thiết lập phù hợp từng bối cảnh.</p></article>
          <article><b>Giai đoạn 2</b><h3>Tư duy hình ảnh</h3><p>Moodboard, vị trí đặt máy, ánh sáng tự nhiên, màu sắc và cách làm nổi bật chủ thể.</p></article>
          <article><b>Giai đoạn 3</b><h3>Tương tác & thực hành</h3><p>Cách hướng dẫn người được chụp, tìm dáng, bắt khoảnh khắc và xử lý một buổi chụp on-location.</p></article>
          <article><b>Đầu ra</b><h3>Bộ ảnh đầu tiên</h3><p>Tự chuẩn bị, chụp, chọn ảnh, chỉnh sửa cơ bản và nhận đánh giá trực tiếp trên sản phẩm hoàn chỉnh.</p></article>
        </div>
      </details>
      <details class="curriculum-item">
        <summary><span class="curriculum-index">02</span><span class="curriculum-title"><small>KỸ NĂNG CHUYÊN SÂU</small><strong>Kỹ thuật nhiếp ảnh</strong></span><span class="curriculum-meta">18.680.000đ / kỹ năng</span><span class="curriculum-toggle">+</span></summary>
        <div class="curriculum-content">
          <article><b>Nền tảng</b><h3>Quy trình sản xuất</h3><p>Đọc brief, xây moodboard và tổ chức quy trình từ ý tưởng đến buổi chụp.</p></article>
          <article><b>Kỹ thuật</b><h3>Thủ pháp thị giác</h3><p>Vị trí đặt máy, góc nhìn, độ sâu, chuyển động và cách tạo nhịp trong một bộ ảnh.</p></article>
          <article><b>Con người</b><h3>Pose & giao tiếp</h3><p>Tìm dáng, hướng dẫn mẫu, tương tác với khách và giữ nhịp làm việc chuyên nghiệp.</p></article>
          <article><b>Đầu ra</b><h3>Project cá nhân</h3><p>Hoàn thiện một concept theo hướng chụp phù hợp với mục tiêu nghề nghiệp.</p></article>
        </div>
      </details>
      <details class="curriculum-item">
        <summary><span class="curriculum-index">03</span><span class="curriculum-title"><small>KỸ NĂNG CHUYÊN SÂU</small><strong>Kỹ thuật ánh sáng</strong></span><span class="curriculum-meta">18.680.000đ / kỹ năng</span><span class="curriculum-toggle">+</span></summary>
        <div class="curriculum-content">
          <article><b>Nền tảng</b><h3>Hiểu nguồn sáng</h3><p>Phân loại ánh sáng, hướng sáng, độ cứng mềm và vai trò của từng loại modifier.</p></article>
          <article><b>Kiểm soát</b><h3>Đo và ước lượng sáng</h3><p>Cường độ, khoảng cách, vùng sáng cần–đủ–đẹp và cách kiểm soát tương phản.</p></article>
          <article><b>Nâng cao</b><h3>Setup & phối màu</h3><p>Các setup phổ biến, cộng màu ánh sáng, bố cục sáng và xử lý nhiều nguồn.</p></article>
          <article><b>Thực hành</b><h3>Indoor & on-location</h3><p>Ứng dụng với tốc độ màn trập khác nhau, concept studio và bối cảnh thực tế.</p></article>
        </div>
       </details>
      <details class="curriculum-item">
        <summary><span class="curriculum-index">04</span><span class="curriculum-title"><small>KỸ NĂNG CHUYÊN SÂU</small><strong>Chỉnh sửa hình ảnh</strong></span><span class="curriculum-meta">18.680.000đ / kỹ năng</span><span class="curriculum-toggle">+</span></summary>
        <div class="curriculum-content">
          <article><b>Đánh giá</b><h3>Quy trình 8 bước</h3><p>Đọc ảnh, xác định vấn đề và định hướng xử lý bằng chỉ số sáng, màu và độ nét.</p></article>
          <article><b>Cơ bản</b><h3>Đúng sáng, màu, nét</h3><p>So sánh công cụ, làm nổi bật chủ thể và xây workflow không phá hủy dữ liệu.</p></article>
          <article><b>Nâng cao</b><h3>Retouch & vùng chọn</h3><p>Tạo vùng chọn, high-end retouch và xử lý các lỗi đặc biệt thường gặp.</p></article>
          <article><b>Hoàn thiện</b><h3>Color grading</h3><p>Thay và chuyển màu, profile màu, calibration, action và quản lý thư mục khoa học.</p></article>
        </div>
      </details>
      <details class="curriculum-item premium-detail">
        <summary><span class="curriculum-index">05</span><span class="curriculum-title"><small>LỘ TRÌNH LÀM NGHỀ</small><strong>Nhiếp ảnh toàn tập</strong></span><span class="curriculum-meta">40.000.000đ · chia tối đa 3 đợt</span><span class="curriculum-toggle">+</span></summary>
        <div class="curriculum-content">
          <article><b>Giai đoạn 1</b><h3>Tư duy & kỹ thuật</h3><p>Xây nền tảng máy ảnh, ngôn ngữ hình ảnh, moodboard và cách triển khai concept.</p></article>
          <article><b>Giai đoạn 2</b><h3>Ánh sáng & sản xuất</h3><p>Setup studio, xử lý bối cảnh thật, làm việc với mẫu, sản phẩm và ekip.</p></article>
          <article><b>Giai đoạn 3</b><h3>Hậu kỳ hoàn chỉnh</h3><p>Chọn ảnh, retouch, color grading và kiểm soát chất lượng đầu ra.</p></article>
          <article><b>Đầu ra</b><h3>Portfolio & định hướng nghề</h3><p>Hoàn thiện portfolio cá nhân, trải nghiệm dự án và định hướng bắt đầu nhận công việc phù hợp.</p></article>
        </div>
      </details>
    </div>
  </div>
</section>`);
  }

  const addNavLink = root => {
    if (!root || root.querySelector('a[href="#chuong-trinh-chi-tiet"]')) return;
    const courseLink = root.querySelector('a[href="#khoa-hoc"]');
    if (!courseLink) return;
    const link = document.createElement('a');
    link.href = '#chuong-trinh-chi-tiet';
    link.textContent = 'Nội dung học';
    courseLink.insertAdjacentElement('afterend', link);
  };
  addNavLink(document.querySelector('.nav-links'));
  addNavLink(document.querySelector('#mobileMenu'));
})();
