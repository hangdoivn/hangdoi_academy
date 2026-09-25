/* Media Career runtime waits for full non-critical styles. */
(()=>{
  let booted=false;
  const boot=()=>{
    if(booted)return;
    booted=true;
    /* runtime 01 */
    (()=>{
      const API="https://candidate-api-v2-production.up.railway.app";
      const p=new URLSearchParams(location.search);
      ["utm_source","utm_medium","utm_campaign","utm_content"].forEach(k=>{
        const v=p.get(k);if(v)sessionStorage.setItem(k,v);
      });
      let sid=sessionStorage.getItem("mcp_sid");
      if(!sid){sid="mcp_"+crypto.randomUUID();sessionStorage.setItem("mcp_sid",sid)}
      const landingEvent=JSON.stringify({
        eventName:"landing_view",
        sessionId:sid,
        path:location.pathname,
        utmSource:sessionStorage.getItem("utm_source")||"",
        utmMedium:sessionStorage.getItem("utm_medium")||"",
        utmCampaign:sessionStorage.getItem("utm_campaign")||"media_career_cohort01",
        utmContent:sessionStorage.getItem("utm_content")||"",
        referrer:document.referrer||""
      });
      let landingSent=false;
      const sendLanding=()=>{
        if(landingSent)return;
        landingSent=true;
        fetch(API+"/v1/events",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          keepalive:true,
          body:landingEvent
        }).catch(()=>{});
      };
      if("requestIdleCallback" in window){
        requestIdleCallback(sendLanding,{timeout:1500});
      }else{
        setTimeout(sendLanding,800);
      }
      addEventListener("pagehide",sendLanding,{once:true});
    
      const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
      if(reduce){document.querySelectorAll(".reveal").forEach(el=>el.classList.add("on"));return}
      const io=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(entry.isIntersecting){
            entry.target.classList.add("on");
            io.unobserve(entry.target);
          }
        });
      },{threshold:.1,rootMargin:"0px 0px -5% 0px"});
      document.querySelectorAll(".reveal").forEach(el=>io.observe(el));
    })();
    
    /* runtime 02 */
    (()=>{
      const frame=document.getElementById("mcv3-bts");
      if(!frame || matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(pointer:fine)").matches) return;
      const image=frame.querySelector("img");
      frame.addEventListener("pointermove",(event)=>{
        const rect=frame.getBoundingClientRect();
        const x=(event.clientX-rect.left)/rect.width-.5;
        const y=(event.clientY-rect.top)/rect.height-.5;
        image.style.transform=`scale(1.02) translate(${x*6}px,${y*5}px)`;
      });
      frame.addEventListener("pointerleave",()=>{ image.style.transform="scale(1)"; });
    })();
    
    /* runtime 03 */
    (()=>{
      const details={
        "01":{
          kicker:"BƯỚC 01 · ĐỀ BÀI",
          visualLabel:"CASE THƯƠNG MẠI / FOUR POINTS",
          visualTitle:"Từ yêu cầu thành đầu bài có thể sản xuất.",
          title:"Biến yêu cầu thành đầu bài có thể sản xuất.",
          copy:"Team làm rõ mục tiêu truyền thông, kênh sử dụng, đối tượng xem, format, số lượng đầu ra và các ràng buộc. Chưa rõ đầu bài thì chưa bàn camera.",
          output:"Brief đã làm rõ + danh sách đầu ra cần bàn giao.",
          image:"/assets/media-career/optimized/fourpoints.webp",
          alt:"Case Four Points do Hang Đôi Production thực hiện",
          roles:["Production Assistant / Owner","Video Creative","Creative Leader / Manager / Director"]
        },
        "02":{
          kicker:"BƯỚC 02 · CHUẨN BỊ",
          visualLabel:"BTS / CHUẨN BỊ TRƯỚC SET",
          visualTitle:"Phần lớn quyết định quan trọng được chốt trước khi bấm máy.",
          title:"Chuẩn bị để ngày quay không trở thành nơi đi tìm câu trả lời.",
          copy:"Research, moodboard, shotlist, lịch, thiết bị, ánh sáng, nhân sự và địa điểm phải khớp với brief trước ngày sản xuất.",
          output:"Moodboard + shotlist + kế hoạch nhân sự, thiết bị và lịch sản xuất.",
          image:"/assets/media-career/optimized/hero-bts.webp",
          alt:"BTS chuẩn bị sản xuất tại Hang Đôi Academy",
          roles:["Production Assistant / Owner","Video Creative","Photographer","Videographer","Creative Leader / Manager / Director"]
        },
        "03":{
          kicker:"BƯỚC 03 · SẢN XUẤT",
          visualLabel:"HOSPITALITY / HOIANA · TRÊN SET",
          visualTitle:"Camera ở đây — nhưng job chưa bắt đầu và cũng chưa kết thúc ở đây.",
          title:"Trên set là lúc kế hoạch phải sống được trong thực tế.",
          copy:"Team vừa ghi hình vừa kiểm soát ánh sáng, góc máy, blocking, continuity, thời gian và những thay đổi thực tế làm lệch kế hoạch.",
          output:"Footage / ảnh đạt shotlist và đủ dữ liệu cho hậu kỳ.",
          image:"/assets/media-career/optimized/xita.webp",
          alt:"Lifestyle Hoiana do Hang Đôi Production thực hiện",
          roles:["Photographer","Videographer","Video Creative","Production Assistant / Owner","Creative Leader / Manager / Director"]
        },
        "04":{
          kicker:"BƯỚC 04 · DỮ LIỆU",
          visualLabel:"SAU SET / QUẢN LÝ DỮ LIỆU",
          visualTitle:"Một set tốt vẫn có thể hỏng nếu dữ liệu hỗn loạn.",
          title:"Dữ liệu phải được bảo vệ trước khi bắt đầu hậu kỳ.",
          copy:"Ingest, backup, naming, folder structure và kiểm tra file diễn ra ngay sau set. Kỷ luật dữ liệu là một phần của chất lượng nghề.",
          output:"Dữ liệu đã kiểm tra, backup và tổ chức theo cấu trúc rõ ràng.",
          image:"/assets/media-career/optimized/hero-bts.webp",
          alt:"BTS quy trình sản xuất tại Hang Đôi Academy",
          roles:["Production Assistant / Owner","Photographer","Videographer","Video Creative"]
        },
        "05":{
          kicker:"BƯỚC 05 · HẬU KỲ",
          visualLabel:"F&B / LÀNG CHÀI · ĐẦU RA",
          visualTitle:"Hậu kỳ biến dữ liệu thành đầu ra phục vụ brief.",
          title:"Đẹp chưa đủ — đầu ra phải đúng mục tiêu sử dụng.",
          copy:"Chọn, dựng, chỉnh ảnh, âm thanh, màu sắc và đồ họa đều quay lại phục vụ brief ban đầu, thay vì chỉ chạy theo cảm giác thẩm mỹ.",
          output:"Bản V1 đủ tiêu chuẩn để đưa vào vòng review.",
          image:"/assets/media-career/optimized/fnb-805.webp",
          alt:"F&B Làng Chài do Hang Đôi Production thực hiện",
          roles:["Video Creative","Photographer","Creative Leader / Manager / Director"]
        },
        "06":{
          kicker:"BƯỚC 06 · GÓP Ý",
          visualLabel:"HOSPITALITY / REVIEW OUTPUT",
          visualTitle:"Feedback cần được hiểu trước khi được sửa.",
          title:"Không biến feedback thành một danh sách thao tác máy móc.",
          copy:"Team đọc feedback, hiểu mục tiêu đằng sau yêu cầu và xác định thay đổi nào thực sự cần thiết để đầu ra tốt hơn.",
          output:"Feedback được phân loại + hướng sửa được thống nhất.",
          image:"/assets/media-career/optimized/floral-9532.webp",
          alt:"Hospitality lifestyle reference do Hang Đôi Production thực hiện",
          roles:["Creative Leader / Manager / Director","Production Assistant / Owner","Video Creative"]
        },
        "07":{
          kicker:"BƯỚC 07 · LÀM LẠI",
          visualLabel:"PRODUCT / DUSTGO · REVISION",
          visualTitle:"Revision là một vòng lặp có kiểm soát, không phải sửa vô hạn.",
          title:"Sửa đúng scope, đúng phiên bản và QC lại trước khi đóng vòng.",
          copy:"Mỗi lần sửa phải có version rõ, thay đổi được kiểm soát và đầu ra được kiểm tra lại. Chưa đạt thì chưa coi là hoàn thành.",
          output:"Final candidate đã QC + version rõ ràng.",
          image:"/assets/media-career/optimized/hd-2988.webp",
          alt:"Product Dustgo do Hang Đôi Production thực hiện",
          roles:["Video Creative","Photographer","Videographer","Production Assistant / Owner","Creative Leader / Manager / Director"]
        },
        "08":{
          kicker:"BƯỚC 08 · BÀN GIAO",
          visualLabel:"HOSPITALITY / FINAL DELIVERY",
          visualTitle:"Chất lượng nghề kết thúc ở cách sản phẩm được bàn giao.",
          title:"Một sản phẩm đẹp nhưng bàn giao sai vẫn là một job chưa hoàn thành.",
          copy:"Đúng file, format, naming, version, nơi nhận và deadline. Sau bàn giao còn cần lưu trữ để team có thể truy xuất lại khi cần.",
          output:"Final delivery + handover / archive rõ ràng.",
          image:"/assets/media-career/optimized/floral-1823.webp",
          alt:"Hospitality final output do Hang Đôi Production thực hiện",
          roles:["Production Assistant / Owner","Video Creative","Creative Leader / Manager / Director"]
        }
      };
    
      const steps=Array.from(document.querySelectorAll(".job-step[data-step]"));
      const detail=document.getElementById("job-detail");
      const home=document.getElementById("job-detail-home");
      if(!steps.length||!detail||!home)return;
    
      const image=document.getElementById("job-detail-image");
      const counter=document.getElementById("job-detail-counter");
      const visualLabel=document.getElementById("job-detail-visual-label");
      const visualTitle=document.getElementById("job-detail-visual-title");
      const kicker=document.getElementById("job-detail-kicker");
      const title=document.getElementById("job-detail-title");
      const copy=document.getElementById("job-detail-copy");
      const output=document.getElementById("job-detail-output");
      const roleWrap=document.getElementById("job-role-chips");
      const mobile=matchMedia("(max-width:760px)");
      const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
    
      const renderRoles=(roles)=>{
        roleWrap.replaceChildren();
        roles.forEach(role=>{
          const chip=document.createElement("span");
          chip.className="job-role-chip";
          chip.textContent=role;
          roleWrap.appendChild(chip);
        });
      };
    
      const placeDetail=(step)=>{
        if(mobile.matches){
          step.insertAdjacentElement("afterend",detail);
        }else if(detail.parentElement!==home){
          home.appendChild(detail);
        }
      };
    
      const selectStep=(step,fromUser)=>{
        const data=details[step.dataset.step];
        if(!data)return;
    
        steps.forEach(item=>{
          const active=item===step;
          item.classList.toggle("is-active",active);
          item.setAttribute("aria-pressed",active?"true":"false");
        });
    
        detail.classList.add("is-updating");
        placeDetail(step);
    
        const update=()=>{
          counter.textContent=step.dataset.step+" / 08";
          visualLabel.textContent=data.visualLabel;
          visualTitle.textContent=data.visualTitle;
          kicker.textContent=data.kicker;
          title.textContent=data.title;
          copy.textContent=data.copy;
          output.textContent=data.output;
          renderRoles(data.roles);
          image.src=data.image;
          image.alt=data.alt;
          detail.setAttribute("aria-labelledby","job-detail-title");
          detail.classList.remove("is-updating");
        };
    
        if(reduce){update()}else{setTimeout(update,110)}
    
        if(fromUser&&mobile.matches){
          requestAnimationFrame(()=>{
            step.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});
          });
        }
      };
    
      steps.forEach((step,index)=>{
        step.addEventListener("click",()=>selectStep(step,true));
        step.addEventListener("keydown",(event)=>{
          if(event.key==="Enter"||event.key===" "){
            event.preventDefault();
            selectStep(step,true);
            return;
          }
          if(event.key==="ArrowDown"||event.key==="ArrowRight"){
            event.preventDefault();
            steps[(index+1)%steps.length].focus();
          }
          if(event.key==="ArrowUp"||event.key==="ArrowLeft"){
            event.preventDefault();
            steps[(index-1+steps.length)%steps.length].focus();
          }
          if(event.key==="Home"){
            event.preventDefault();
            steps[0].focus();
          }
          if(event.key==="End"){
            event.preventDefault();
            steps[steps.length-1].focus();
          }
        });
      });
    
      const onViewportChange=()=>{
        const active=steps.find(step=>step.classList.contains("is-active"))||steps[0];
        placeDetail(active);
      };
      if(mobile.addEventListener)mobile.addEventListener("change",onViewportChange);
      else mobile.addListener(onViewportChange);
      onViewportChange();
    })();
    
    /* runtime 04 */
    (()=>{
      const data={
        "01":{
          kicker:"THÁNG 01 · LÀM QUEN THUẬT NGỮ: TOOL",
          title:"LÀM QUEN & LÀM CHỦ THIẾT BỊ.",
          desc:"Biết tự setup máy, ánh sáng và âm thanh để quay/chụp đúng mục tiêu.",
          proof:"BẠN CÓ · 01 BÀI THỰC HÀNH KỸ THUẬT",
          focus:"Tập trung: máy ảnh · ánh sáng · âm thanh · gimbal",
          image:"/assets/media-career/optimized/roadmap-01-thiet-bi.webp",
          alt:"Học viên thực hành thiết bị tại Hang Đôi Academy",
          label:"BTS HANG ĐÔI ACADEMY · THỰC HÀNH"
        },
        "02":{
          kicker:"THÁNG 02 · LÀM QUEN THUẬT NGỮ: BRIEF",
          title:"LÀM THEO YÊU CẦU THẬT.",
          desc:"Biết đọc yêu cầu và bắt đầu làm việc theo mục tiêu rõ ràng.",
          proof:"BẠN CÓ · 01 BÀI THỰC HÀNH THƯƠNG MẠI",
          focus:"Tập trung: trao đổi · hiểu yêu cầu · phối hợp · định hướng đầu ra",
          image:"/assets/media-career/optimized/roadmap-02-yeu-cau.webp",
          alt:"Học viên trao đổi và làm việc theo yêu cầu tại Hang Đôi Academy",
          label:"BTS HANG ĐÔI ACADEMY · LÀM VIỆC THEO YÊU CẦU"
        },
        "03":{
          kicker:"THÁNG 03 · LÀM QUEN THUẬT NGỮ: OUTPUT",
          title:"HOÀN THIỆN SẢN PHẨM.",
          desc:"Biết theo dõi hình ảnh trên màn hình, kiểm soát chất lượng và hoàn thiện đầu ra.",
          proof:"BẠN CÓ · 01 SẢN PHẨM HOÀN THIỆN",
          focus:"Tập trung: kiểm tra hình · chất lượng · hoàn thiện · bàn giao",
          image:"/assets/media-career/optimized/roadmap-03-san-pham.webp",
          alt:"Học viên kiểm soát hình ảnh và đầu ra tại Hang Đôi Academy",
          label:"BTS HANG ĐÔI ACADEMY · KIỂM SOÁT ĐẦU RA"
        },
        "04":{
          kicker:"THÁNG 04 · LÀM QUEN THUẬT NGỮ: JOB",
          title:"LÀM TRỌN MỘT DỰ ÁN.",
          desc:"Tự đi từ nhận yêu cầu → chuẩn bị → quay/chụp → chỉnh sửa → bàn giao.",
          proof:"BẠN CÓ · ĐỒ ÁN CUỐI KHÓA + HỒ SƠ SẢN PHẨM",
          focus:"Tập trung: hoàn thành dự án · chốt đầu ra · sẵn sàng portfolio",
          image:"/assets/media-career/optimized/roadmap-04-du-an.webp",
          alt:"Học viên hoàn thành khóa học tại Hang Đôi Academy",
          label:"BTS HANG ĐÔI ACADEMY · HOÀN THÀNH CUỐI KHÓA"
        }
      };
    
      const section=document.getElementById("system");
      const roadmap=section?.querySelector(".program4-roadmap");
      const pins=Array.from(document.querySelectorAll(".program4-roadmap-pin[data-stage]"));
      const detail=document.getElementById("program4-detail");
      if(!section||!roadmap||!pins.length||!detail)return;
    
      const title=document.getElementById("program4-detail-title");
      const kicker=document.getElementById("program4-detail-kicker");
      const desc=document.getElementById("program4-detail-desc");
      const proof=document.getElementById("program4-detail-proof");
      const focus=document.getElementById("program4-detail-focus");
      const num=document.getElementById("program4-detail-no");
      const image=document.getElementById("program4-detail-image");
      const label=document.getElementById("program4-detail-media-label");
      const bars=Array.from(document.querySelectorAll(".program4-detail-progress span"));
      const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
      const mobile=matchMedia("(max-width:760px)");
      const finePointer=matchMedia("(pointer:fine)").matches;
      const STEP_MS=5200;
    
      let current=0;
      let timer=null;
      let paused=false;
      let inView=false;
      let updateTimer=null;
    
      Object.values(data).forEach(item=>{
        const preload=new Image();
        preload.src=item.image;
      });
    
      const restartProgress=(index)=>{
        bars.forEach((bar,i)=>{
          const active=i===index;
          bar.classList.toggle("is-active",active);
          if(active&&!reduce){
            bar.style.animation="none";
            void bar.offsetWidth;
            bar.style.animation="";
          }
        });
      };
    
      const clearTimer=()=>{
        if(timer){clearTimeout(timer);timer=null}
      };
    
      const schedule=()=>{
        clearTimer();
        if(reduce||mobile.matches||paused||!inView)return;
        timer=setTimeout(()=>{
          const next=(current+1)%pins.length;
          select(pins[next],{animate:true});
          schedule();
        },STEP_MS);
      };
    
      const updateDetail=(pin,animate)=>{
        const d=data[pin.dataset.stage];
        if(!d)return;
    
        if(updateTimer)clearTimeout(updateTimer);
        detail.classList.remove("is-switching");
        if(animate&&!reduce){
          void detail.offsetWidth;
          detail.classList.add("is-switching");
          image.style.opacity="0";
        }
    
        const apply=()=>{
          kicker.textContent=d.kicker;
          title.textContent=d.title;
          desc.textContent=d.desc;
          proof.textContent=d.proof;
          focus.textContent=d.focus;
          num.textContent=pin.dataset.stage;
          label.textContent=d.label;
          image.src=d.image;
          image.alt=d.alt;
          image.style.opacity="1";
          if(!reduce){
            setTimeout(()=>detail.classList.remove("is-switching"),480);
          }
        };
    
        if(animate&&!reduce)updateTimer=setTimeout(apply,110);
        else apply();
      };
    
      function select(pin,{user=false,animate=true}={}){
        const index=pins.indexOf(pin);
        if(index<0)return;
        current=index;
    
        pins.forEach(item=>{
          const active=item===pin;
          item.classList.toggle("is-active",active);
          item.setAttribute("aria-pressed",active?"true":"false");
        });
        restartProgress(index);
        updateDetail(pin,animate);
    
        if(user)schedule();
      }
    
      const pause=()=>{
        paused=true;
        clearTimer();
      };
      const resume=()=>{
        paused=false;
        schedule();
      };
    
      pins.forEach((pin,index)=>{
        pin.addEventListener("click",()=>select(pin,{user:true,animate:true}));
        pin.addEventListener("focus",()=>{
          pause();
          select(pin,{animate:true});
        });
        pin.addEventListener("blur",()=>{
          requestAnimationFrame(()=>{
            if(!roadmap.contains(document.activeElement))resume();
          });
        });
    
        if(finePointer){
          pin.addEventListener("pointerenter",()=>{
            pause();
            select(pin,{animate:true});
          });
          pin.addEventListener("pointerleave",resume);
        }
    
        pin.addEventListener("keydown",(event)=>{
          if(event.key==="ArrowRight"||event.key==="ArrowDown"){
            event.preventDefault();
            pins[(index+1)%pins.length].focus();
          }else if(event.key==="ArrowLeft"||event.key==="ArrowUp"){
            event.preventDefault();
            pins[(index-1+pins.length)%pins.length].focus();
          }else if(event.key==="Home"){
            event.preventDefault();pins[0].focus();
          }else if(event.key==="End"){
            event.preventDefault();pins[pins.length-1].focus();
          }
        });
      });
    
      detail.addEventListener("pointerenter",()=>{
        if(finePointer)pause();
      });
      detail.addEventListener("pointerleave",()=>{
        if(finePointer)resume();
      });
    
      document.addEventListener("visibilitychange",()=>{
        if(document.hidden)pause();
        else resume();
      });
    
      if("IntersectionObserver" in window){
        const observer=new IntersectionObserver(entries=>{
          inView=entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=.25);
          if(inView)schedule(); else clearTimer();
        },{threshold:[0,.25,.5]});
        observer.observe(section);
      }else{
        inView=true;
      }
    
      select(pins[0],{animate:false});
      schedule();
    })();
    
    /* runtime 05 */
    (()=>{
      const section=document.getElementById("learning-loop");
      if(!section)return;
    
      const steps=[
        {
          kicker:"BƯỚC 01 · LÀM",
          title:"LÀM MỘT PHIÊN BẢN.",
          desc:"Biến điều vừa học thành một sản phẩm cụ thể để có thứ thật mà xem lại.",
          proof:"CÓ THỨ THẬT ĐỂ ĐÁNH GIÁ",
          version:"VERSION 01 · ĐANG LÀM"
        },
        {
          kicker:"BƯỚC 02 · XEM LẠI",
          title:"XEM LẠI CÙNG NHAU.",
          desc:"Đặt sản phẩm cạnh mục tiêu ban đầu để nhìn ra điểm đang ổn và điểm còn thiếu.",
          proof:"BIẾT MÌNH ĐANG Ở ĐÂU",
          version:"VERSION 01 · ĐANG REVIEW"
        },
        {
          kicker:"BƯỚC 03 · NHẬN GÓP Ý",
          title:"BIẾT CHỖ NÀO CHƯA ỔN.",
          desc:"Góp ý phải chỉ rõ điều cần sửa, thay vì chỉ nói “đẹp” hay “chưa đẹp”.",
          proof:"BIẾT CHÍNH XÁC CẦN SỬA GÌ",
          version:"REVIEW · CÓ GÓP Ý CỤ THỂ"
        },
        {
          kicker:"BƯỚC 04 · SỬA & LÀM LẠI",
          title:"LÀM PHIÊN BẢN TỐT HƠN.",
          desc:"Sửa kỹ thuật, cách xử lý hoặc làm lại nếu cần. Phiên bản sau phải tốt hơn phiên bản trước.",
          proof:"VERSION 02 > VERSION 01",
          version:"VERSION 02 · ĐÃ CẢI THIỆN"
        }
      ];
    
      const panel=document.getElementById("loop5-panel");
      const visual=document.getElementById("loop5-visual");
      const kicker=document.getElementById("loop5-step-kicker");
      const number=document.getElementById("loop5-step-no");
      const title=document.getElementById("loop5-step-title");
      const desc=document.getElementById("loop5-step-desc");
      const proof=document.getElementById("loop5-step-proof");
      const version=document.getElementById("loop5-version");
      const buttons=Array.from(section.querySelectorAll(".loop5-btn[data-loop-step]"));
      const bars=Array.from(section.querySelectorAll(".loop5-timer span"));
    
      const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
      const mobile=matchMedia("(max-width:760px)");
      const finePointer=matchMedia("(pointer:fine)").matches;
      const STEP_MS=4800;
      let current=0;
      let timer=null;
      let paused=false;
      let inView=false;
    
      const clearTimer=()=>{
        if(timer){clearTimeout(timer);timer=null}
      };
    
      const restartTimerBar=(index)=>{
        bars.forEach((bar,i)=>{
          const active=i===index;
          bar.classList.toggle("is-active",active);
          if(active&&!reduce){
            bar.style.animation="none";
            void bar.offsetWidth;
            bar.style.animation="";
          }
        });
      };
    
      const select=(index,{animate=true}={})=>{
        if(index<0||index>=steps.length)return;
        current=index;
        const s=steps[index];
    
        buttons.forEach((button,i)=>{
          const active=i===index;
          button.classList.toggle("is-active",active);
          button.setAttribute("aria-pressed",active?"true":"false");
        });
        restartTimerBar(index);
    
        visual.dataset.step=String(index+1);
        if(animate&&!reduce){
          panel.classList.remove("is-switching");
          void panel.offsetWidth;
          panel.classList.add("is-switching");
          setTimeout(()=>panel.classList.remove("is-switching"),460);
        }
    
        kicker.textContent=s.kicker;
        number.textContent=String(index+1).padStart(2,"0")+" / 04";
        title.textContent=s.title;
        desc.textContent=s.desc;
        proof.textContent=s.proof;
        version.textContent=s.version;
      };
    
      const schedule=()=>{
        clearTimer();
        if(reduce||mobile.matches||paused||!inView)return;
        timer=setTimeout(()=>{
          select((current+1)%steps.length,{animate:true});
          schedule();
        },STEP_MS);
      };
    
      const pause=()=>{
        paused=true;
        clearTimer();
      };
      const resume=()=>{
        paused=false;
        schedule();
      };
    
      buttons.forEach((button,index)=>{
        button.addEventListener("click",()=>{
          select(index,{animate:true});
          resume();
        });
        button.addEventListener("focus",()=>{
          pause();
          select(index,{animate:true});
        });
        button.addEventListener("blur",()=>{
          requestAnimationFrame(()=>{
            if(!section.contains(document.activeElement))resume();
          });
        });
        if(finePointer){
          button.addEventListener("pointerenter",()=>{
            pause();
            select(index,{animate:true});
          });
          button.addEventListener("pointerleave",resume);
        }
        button.addEventListener("keydown",(event)=>{
          if(event.key==="ArrowRight"||event.key==="ArrowDown"){
            event.preventDefault();
            buttons[(index+1)%buttons.length].focus();
          }else if(event.key==="ArrowLeft"||event.key==="ArrowUp"){
            event.preventDefault();
            buttons[(index-1+buttons.length)%buttons.length].focus();
          }else if(event.key==="Home"){
            event.preventDefault();buttons[0].focus();
          }else if(event.key==="End"){
            event.preventDefault();buttons[buttons.length-1].focus();
          }
        });
      });
    
      const stage=section.querySelector(".loop5-stage");
      if(finePointer&&stage){
        stage.addEventListener("pointerenter",pause);
        stage.addEventListener("pointerleave",resume);
      }
    
      document.addEventListener("visibilitychange",()=>{
        if(document.hidden)pause();
        else resume();
      });
    
      if("IntersectionObserver" in window){
        const observer=new IntersectionObserver(entries=>{
          inView=entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=.25);
          if(inView)schedule(); else clearTimer();
        },{threshold:[0,.25,.5]});
        observer.observe(section);
      }else{
        inView=true;
      }
    
      select(0,{animate:false});
      schedule();
    })();
    
    /* runtime 06 */
    (()=>{
      const section=document.getElementById("roles");
      if(!section)return;
    
      const data={
        photo:{
          index:"01",
          kicker:"HƯỚNG 01 · PHOTOGRAPHER",
          title:"THÍCH NHÌN MỘT KHUNG HÌNH CHO ĐÚNG.",
          desc:"Bạn để ý ánh sáng, bố cục, khoảnh khắc và thường muốn chỉnh từng chi tiết để hình ảnh “đúng cảm giác” hơn.",
          fit:["ÁNH SÁNG","BỐ CỤC","CHI TIẾT","KHOẢNH KHẮC"],
          path:[
            ["Trợ lý nhiếp ảnh","Hỗ trợ thiết bị, ánh sáng và set."],
            ["Photographer","Tự thực hiện những bài chụp phù hợp năng lực."],
            ["Commercial Photographer","Đi sâu vào hình ảnh thương mại và dự án lớn hơn."]
          ]
        },
        video:{
          index:"02",
          kicker:"HƯỚNG 02 · VIDEOGRAPHER",
          title:"THÍCH CAMERA CHUYỂN ĐỘNG VÀ SET ĐANG CHẠY.",
          desc:"Bạn hứng thú với camera, gimbal, chuyển động và việc bắt đúng khoảnh khắc khi mọi thứ đang diễn ra.",
          fit:["CAMERA","GIMBAL","MOVEMENT","SET"],
          path:[
            ["Camera Assistant","Hỗ trợ camera, lens, pin, thẻ và setup."],
            ["Videographer","Tự vận hành camera cho những bài quay phù hợp."],
            ["Lead Camera / DOP","Đi sâu vào ngôn ngữ hình ảnh và dẫn phần camera."]
          ]
        },
        creative:{
          index:"03",
          kicker:"HƯỚNG 03 · VIDEO CREATIVE",
          title:"THÍCH BIẾN Ý TƯỞNG THÀNH MỘT VIDEO CÓ NHỊP.",
          desc:"Bạn quan tâm đến concept, shotlist, nhịp dựng và cách nhiều cảnh ghép lại thành một câu chuyện dễ xem.",
          fit:["IDEA","SHOTLIST","EDIT","STORY"],
          path:[
            ["Creative / Edit Assistant","Hỗ trợ research, footage và dựng cơ bản."],
            ["Video Creative","Phát triển ý tưởng và đi cùng video từ đầu đến cuối."],
            ["Creative Leader","Dẫn concept, định hướng hình ảnh và phối hợp team."]
          ]
        },
        production:{
          index:"04",
          kicker:"HƯỚNG 04 · PRODUCTION",
          title:"THÍCH LÀM CHO CẢ SET CHẠY ĐÚNG.",
          desc:"Bạn để ý con người, timeline, thiết bị và đầu việc. Thay vì chỉ tập trung vào một khung hình, bạn nhìn toàn bộ quy trình.",
          fit:["ĐIỀU PHỐI","TIMELINE","TEAM","QUY TRÌNH"],
          path:[
            ["Production Assistant","Hỗ trợ set, checklist, thiết bị và vận hành."],
            ["Production Coordinator / Owner","Chịu trách nhiệm nhiều phần việc hơn của một job."],
            ["Manager / Director","Phát triển theo hướng quản lý team hoặc creative/production leadership."]
          ]
        }
      };
    
      const tabs=Array.from(section.querySelectorAll(".roles7-tab[data-role]"));
      const main=document.getElementById("roles7-detail-main");
      const kicker=document.getElementById("roles7-detail-kicker");
      const title=document.getElementById("roles7-detail-title");
      const desc=document.getElementById("roles7-detail-desc");
      const fit=document.getElementById("roles7-fit");
      const path=document.getElementById("roles7-path-list");
      const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
      const finePointer=matchMedia("(pointer:fine)").matches;
    
      const select=(role,{animate=true}={})=>{
        const d=data[role];
        if(!d)return;
    
        tabs.forEach(tab=>{
          const active=tab.dataset.role===role;
          tab.classList.toggle("is-active",active);
          tab.setAttribute("aria-pressed",active?"true":"false");
        });
    
        if(animate&&!reduce){
          main.classList.remove("is-switching");
          void main.offsetWidth;
          main.classList.add("is-switching");
          setTimeout(()=>main.classList.remove("is-switching"),430);
        }
    
        main.dataset.index=d.index;
        kicker.textContent=d.kicker;
        title.textContent=d.title;
        desc.textContent=d.desc;
        fit.innerHTML=d.fit.map(item=>"<span>"+item+"</span>").join("");
        path.innerHTML=d.path.map((item,index)=>
          '<div class="roles7-path-step"><b>'+String(index+1).padStart(2,"0")+'</b><div><strong>'+item[0]+'</strong><span>'+item[1]+'</span></div></div>'
        ).join("");
      };
    
      tabs.forEach((tab,index)=>{
        tab.addEventListener("click",()=>select(tab.dataset.role));
        tab.addEventListener("focus",()=>select(tab.dataset.role));
        if(finePointer)tab.addEventListener("pointerenter",()=>select(tab.dataset.role));
        tab.addEventListener("keydown",(event)=>{
          if(event.key==="ArrowRight"||event.key==="ArrowDown"){
            event.preventDefault();
            tabs[(index+1)%tabs.length].focus();
          }else if(event.key==="ArrowLeft"||event.key==="ArrowUp"){
            event.preventDefault();
            tabs[(index-1+tabs.length)%tabs.length].focus();
          }else if(event.key==="Home"){
            event.preventDefault();tabs[0].focus();
          }else if(event.key==="End"){
            event.preventDefault();tabs[tabs.length-1].focus();
          }
        });
      });
    })();
    
    /* runtime 07 */
    (()=>{
      const section=document.querySelector(".career9");
      if(!section)return;
      if(matchMedia("(prefers-reduced-motion: reduce)").matches){section.classList.add("is-active");return}
      if("IntersectionObserver" in window){
        const obs=new IntersectionObserver(entries=>{
          if(entries.some(e=>e.isIntersecting&&e.intersectionRatio>=.18)){
            section.classList.add("is-active");
            obs.disconnect();
          }
        },{threshold:[.18,.3]});
        obs.observe(section);
      }else section.classList.add("is-active");
    })();
    
    /* runtime 08 */
    (()=>{
      const reduce=matchMedia("(prefers-reduced-motion: reduce)");
      document.querySelectorAll(".faq12-item").forEach(details=>{
        const summary=details.querySelector("summary");
        const answer=details.querySelector(".faq12-answer");
        if(!summary||!answer)return;
        let outer=null,inner=null;
        const stop=()=>{if(outer)outer.cancel();if(inner)inner.cancel();outer=inner=null};
        const clean=()=>{details.style.height="";details.style.overflow="";answer.style.opacity="";answer.style.transform=""};
        const closedHeight=()=>{
          const cs=getComputedStyle(details);
          return summary.getBoundingClientRect().height+(parseFloat(cs.borderTopWidth)||0)+(parseFloat(cs.borderBottomWidth)||0);
        };
        summary.addEventListener("click",event=>{
          event.preventDefault();
          stop();
          if(reduce.matches){details.open=!details.open;clean();return}
          if(!details.open){
            const from=closedHeight();
            details.open=true;
            details.style.height="auto";
            const to=details.scrollHeight+(parseFloat(getComputedStyle(details).borderBottomWidth)||0);
            details.style.height=from+"px";details.style.overflow="hidden";
            outer=details.animate([{height:from+"px"},{height:to+"px"}],{duration:400,easing:"cubic-bezier(.22,1,.36,1)"});
            inner=answer.animate([{opacity:0,transform:"translateY(-7px)"},{opacity:1,transform:"translateY(0)"}],{duration:320,delay:45,easing:"cubic-bezier(.22,1,.36,1)",fill:"both"});
            outer.onfinish=()=>{outer=null;if(inner){inner.cancel();inner=null}clean()};
          }else{
            const from=details.getBoundingClientRect().height;
            const to=closedHeight();
            details.style.height=from+"px";details.style.overflow="hidden";
            outer=details.animate([{height:from+"px"},{height:to+"px"}],{duration:340,easing:"cubic-bezier(.4,0,.2,1)"});
            inner=answer.animate([{opacity:1,transform:"translateY(0)"},{opacity:0,transform:"translateY(-5px)"}],{duration:230,easing:"ease-out",fill:"both"});
            outer.onfinish=()=>{
              details.style.height=to+"px";
              details.open=false;
              if(inner){inner.cancel();inner=null}
              requestAnimationFrame(()=>requestAnimationFrame(clean));
              outer=null;
            };
          }
        });
      });
    })();
    
    /* runtime 09 */
    (()=>{
      const bar=document.querySelector(".mobile-cta");
      const hero=document.getElementById("hero");
      const finalSection=document.querySelector(".final13-section");
      const footer=document.querySelector(".academy-footer-v2");
      const mobile=matchMedia("(max-width:760px)");
      if(!bar||!hero)return;
    
      let heroVisible=true;
      let endVisible=false;
    
      const sync=()=>{
        const show=mobile.matches&&!heroVisible&&!endVisible;
        bar.classList.toggle("is-visible",show);
        bar.setAttribute("aria-hidden",show?"false":"true");
        bar.inert=!show;
      };
    
      if("IntersectionObserver" in window){
        const heroObserver=new IntersectionObserver(entries=>{
          heroVisible=entries.some(entry=>entry.isIntersecting);
          sync();
        },{threshold:0});
        heroObserver.observe(hero);
    
        if(finalSection||footer){
          const endObserver=new IntersectionObserver(entries=>{
            endVisible=entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>.08);
            sync();
          },{threshold:[0,.08,.2]});
          if(finalSection)endObserver.observe(finalSection);
          if(footer)endObserver.observe(footer);
        }
      }else{
        const fallback=()=>{
          const hr=hero.getBoundingClientRect();
          const fr=finalSection?finalSection.getBoundingClientRect():null;
          const ftr=footer?footer.getBoundingClientRect():null;
          heroVisible=hr.bottom>0&&hr.top<innerHeight;
          endVisible=(fr&&fr.top<innerHeight*.92&&fr.bottom>0)||(ftr&&ftr.top<innerHeight*.92&&ftr.bottom>0);
          sync();
        };
        addEventListener("scroll",fallback,{passive:true});
        fallback();
      }
    
      const onMediaChange=()=>sync();
      if(mobile.addEventListener)mobile.addEventListener("change",onMediaChange);
      else mobile.addListener(onMediaChange);
      sync();
    })();
    
    /* runtime 10 */
    (()=>{
      const section=document.getElementById("gap");
      if(!section)return;
      const rail=section.querySelector(".gap2-flow");
      const cards=Array.from(section.querySelectorAll(".gap2-stage"));
      const progress=section.querySelector(".gap2-mobile-progress");
      if(!rail||cards.length<2||!progress)return;
    
      const label=progress.querySelector(".gap2-progress-label b");
      const dots=Array.from(progress.querySelectorAll(".gap2-progress-dots i"));
      const mobile=matchMedia("(max-width:760px)");
      const setActive=(active)=>{
        if(!mobile.matches)return;
        if(label)label.textContent=String(active+1).padStart(2,"0");
        dots.forEach((dot,index)=>dot.classList.toggle("is-active",index===active));
      };
    
      if("IntersectionObserver" in window){
        const ratios=new Map(cards.map(card=>[card,0]));
        const observer=new IntersectionObserver(entries=>{
          entries.forEach(entry=>ratios.set(entry.target,entry.intersectionRatio));
          let active=0;
          let best=-1;
          cards.forEach((card,index)=>{
            const ratio=ratios.get(card)||0;
            if(ratio>best){best=ratio;active=index}
          });
          setActive(active);
        },{
          root:rail,
          threshold:[0,.25,.5,.75,1]
        });
        cards.forEach(card=>observer.observe(card));
      }else{
        let raf=0;
        const sync=()=>{
          raf=0;
          if(!mobile.matches)return;
          const active=Math.max(0,Math.min(cards.length-1,Math.round(
            rail.scrollLeft/Math.max(1,cards[0].getBoundingClientRect().width)
          )));
          setActive(active);
        };
        rail.addEventListener("scroll",()=>{
          if(!raf)raf=requestAnimationFrame(sync);
        },{passive:true});
        sync();
      }
    
      setActive(0);
    })();
    
    /* runtime 11 */
    (()=>{
      const mobile=matchMedia("(max-width:760px)");
    
      /* Section 04: move the active month detail directly below its node. */
      const system=document.getElementById("system");
      if(system){
        const roadmap=system.querySelector(".program4-roadmap");
        const pins=Array.from(system.querySelectorAll(".program4-roadmap-pin"));
        const wrap=system.querySelector(".program4-detail-wrap");
        const home=wrap?.parentElement;
        const place=()=>{
          if(!wrap||!roadmap)return;
          if(mobile.matches){
            const active=pins.find(p=>p.classList.contains("is-active"))||pins[0];
            if(active)active.insertAdjacentElement("afterend",wrap);
          }else if(home&&wrap.parentElement!==home){
            const bridge=home.querySelector(".program4-bridge");
            if(bridge)home.insertBefore(wrap,bridge);
            else home.appendChild(wrap);
          }
        };
        pins.forEach(pin=>pin.addEventListener("click",()=>requestAnimationFrame(place)));
        const observer=new MutationObserver(place);
        pins.forEach(pin=>observer.observe(pin,{attributes:true,attributeFilter:["class"]}));
        if(mobile.addEventListener)mobile.addEventListener("change",place);
        place();
      }
    
      /* Section 05: when a step is tapped, keep its horizontal tab visible. */
      const loop=document.getElementById("learning-loop");
      if(loop){
        const buttons=Array.from(loop.querySelectorAll(".loop5-btn"));
        buttons.forEach(btn=>btn.addEventListener("click",()=>{
          if(mobile.matches){
            requestAnimationFrame(()=>btn.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"}));
          }
        }));
      }
    })();
    
    /* runtime 12 */
    (()=>{
      const mobile=matchMedia("(max-width:760px)");
    
      /* FAQ starts collapsed on phones so users scan questions before opening one. */
      const faq=document.getElementById("faq");
      const closeFaq=()=>{
        if(!faq||!mobile.matches)return;
        faq.querySelectorAll(".faq12-item[open]").forEach(item=>{item.open=false});
      };
      closeFaq();
      if(mobile.addEventListener)mobile.addEventListener("change",()=>{
        if(mobile.matches)closeFaq();
      });
    })();
    
  };

  const styles=document.querySelector('link[data-program-styles]');
  const start=()=>{
    if(styles)styles.media='all';
    requestAnimationFrame(()=>requestAnimationFrame(boot));
  };

  if(!styles){
    boot();
  }else if(styles.sheet){
    start();
  }else{
    styles.addEventListener('load',start,{once:true});
    styles.addEventListener('error',boot,{once:true});
    setTimeout(start,2500);
  }
})();
