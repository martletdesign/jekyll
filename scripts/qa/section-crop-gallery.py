#!/usr/bin/env python3
"""Generate licensed art-direction candidates from exact, untouched source photos."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT=Path(__file__).resolve().parents[2]
TITLES={"martlet-architecture":"A collection of possibilities.",
        "martlet-library":"A language worth keeping.",
        "martlet-manuscript":"Journal"}
# name, aspect, source horizontal anchor, source vertical anchor
CROPS=[("wide-upper",4.5,.5,.12),("wide-middle",4.5,.5,.50),
       ("wide-lower",4.5,.5,.86),("panorama-upper",3.,.5,.18),
       ("panorama-lower",3.,.5,.72),("deep-section",2.3,.5,.53),
       ("mobile-left",1.,.12,.5),("mobile-right",1.,.88,.5)]
FRAMES={"desktop-wide":(1440,320),"desktop-short":(1024,300),
        "tablet":(768,300),"phone":(390,230)}

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def font(n):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"):
        if Path(p).exists():return ImageFont.truetype(p,n)
    return ImageFont.load_default()

def crop_box(w,h,ratio,fx,fy):
    if w/h>=ratio: cw,ch=round(h*ratio),h
    else: cw,ch=w,round(w/ratio)
    cw,ch=min(cw,w),min(ch,h)
    left=round((w-cw)*fx);top=round((h-ch)*fy)
    return(left,top,left+cw,top+ch)

def rendered_frame(photo,viewport,title):
    w,h=viewport
    image=ImageOps.fit(photo,(w,h),Image.Resampling.LANCZOS).convert("RGBA")
    overlay=Image.new("RGBA",(w,h),(0,0,0,0));d=ImageDraw.Draw(overlay)
    for x in range(w):
        alpha=round(175*((1-x/max(1,w-1))**1.45))
        d.line((x,0,x,h),fill=(37,23,11,alpha))
    image=Image.alpha_composite(image,overlay)
    d=ImageDraw.Draw(image);sz=max(14,min(30,round(w*.023)))
    d.text((max(16,w//35),h//2-sz),title,font=font(sz),
           fill=(248,244,233,255),stroke_width=1,stroke_fill=(31,20,11,200))
    return image.convert("RGB")

def save_sheet(ident,samples,viewport,label,out):
    vw,vh=viewport;dw=570 if vw>=1000 else (480 if vw>=700 else 390)
    dh=round(dw*vh/vw);pad=20;title_height=70;label_height=45
    rows=(len(samples)+1)//2
    canvas=Image.new("RGB",(2*dw+3*pad,title_height+rows*(dh+label_height+pad)),"#f8f4e9")
    d=ImageDraw.Draw(canvas)
    d.text((pad,18),ident+" / "+label+" / CSS cover preview",font=font(22),fill="#25170b")
    for i,(name,cropped,box) in enumerate(samples):
        col,row=i%2,i//2;x=pad+col*(dw+pad);y=title_height+row*(dh+label_height+pad)
        frame=rendered_frame(cropped,(dw,dh),TITLES[ident]);canvas.paste(frame,(x,y))
        d.rectangle((x,y,x+dw-1,y+dh-1),outline="#806600",width=1)
        d.text((x,y+dh+7),name+"  / source "+str(box[2]-box[0])+" x "+str(box[3]-box[1]),
               font=font(14),fill="#25170b")
    canvas.save(out,optimize=True)

def make(ident,out):
    meta=json.loads((ROOT/"_hero_sources/provenance"/(ident+".json")).read_text())
    original=ROOT/meta["originalFile"]
    assert digest(original)==meta["sourceSha256"],"Original source checksum changed: "+ident
    with Image.open(original) as f:
        photo=ImageOps.exif_transpose(f).convert("RGB")
    assert photo.size==(meta["sourceWidth"],meta["sourceHeight"])
    candidate_dir=out/"candidates"/ident;candidate_dir.mkdir(parents=True,exist_ok=True)
    samples=[];entries=[]
    for name,ratio,fx,fy in CROPS:
        box=crop_box(*photo.size,ratio,fx,fy);part=photo.crop(box)
        samples.append((name,part,box));variants=[]
        for width in (960,1920):
            resized=part.resize((width,round(width*part.height/part.width)),Image.Resampling.LANCZOS)
            dest=candidate_dir/(ident+"--"+name+"--"+str(width)+".webp")
            resized.save(dest,"WEBP",quality=88,method=6)
            variants.append({"path":dest.relative_to(out).as_posix(),"width":resized.width,
                             "height":resized.height,"sha256":digest(dest)})
        entries.append({"name":name,"aspect":ratio,"focal":[fx,fy],"cropBoxPixels":list(box),
                        "sourceFraction":round(part.width*part.height/(photo.width*photo.height),4),
                        "variants":variants})
    sheets=out/"contact-sheets";sheets.mkdir(parents=True,exist_ok=True)
    for name,viewport in FRAMES.items():
        save_sheet(ident,samples,viewport,name,sheets/(ident+"--"+name+".png"))
    return {"id":ident,"sourceSha256":meta["sourceSha256"],"sourcePage":meta["sourcePage"],
            "license":meta["license"],"originalSize":list(photo.size),"candidateCrops":entries}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--output",required=True,type=Path)
    p.add_argument("--source",default="all",choices=["all",*TITLES])
    args=p.parse_args();out=args.output.resolve();out.mkdir(parents=True,exist_ok=True)
    names=list(TITLES) if args.source=="all" else [args.source]
    manifest={"version":1,"usage":"review only","tintEmbedded":False,
              "frameBehavior":"object-fit: cover; overflow: hidden",
              "sources":[make(n,out) for n in names]}
    (out/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    (out/"README.md").write_text(
      "# Martlet section crop review\n\n"
      "Eight crops from each unchanged, checksum-verified original photograph are compared "
      "inside four identical display frames. Contact sheets include a simulated warm CSS "
      "gradient ONLY for preview. Clean candidate WebP files carry no tint or altered color. "
      "Images may overflow and be clipped by the frame. Select per screen context after "
      "reviewing the gallery; do not assume a single crop fits every width.\n\n"
      "The exact original CC licenses, source links, modifications and hashes appear in "
      "manifest.json. The site's existing visible attribution must remain.\n")
    paths=sorted(f for f in out.rglob("*") if f.is_file() and f.name!="SHA256SUMS")
    (out/"SHA256SUMS").write_text("".join(digest(f)+"  "+f.relative_to(out).as_posix()+"\n" for f in paths))
    print(json.dumps({"sources":names,"cropsPerSource":len(CROPS),"frames":list(FRAMES),
                      "output":str(out)},sort_keys=True))

if __name__=="__main__":main()
