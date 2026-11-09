import { ImageResponse } from "next/og";

export const OG_SIZE = { height: 630, width: 1200 } as const;
export const OG_CONTENT_TYPE = "image/png";

const LOGO_CLIP = "M 30 102 L 344.917969 102 L 344.917969 273 L 30 273 Z";
const LOGO_DIAMONDS =
  "M 236.300781 212.144531 C 238.496094 208.355469 238.695312 203.496094 236.300781 199.371094 L 225.1875 180.144531 L 214.078125 199.371094 C 211.683594 203.429688 211.882812 208.355469 214.078125 212.144531 C 215.144531 214.007812 216.738281 215.671875 218.800781 216.804688 C 220.796875 217.933594 222.992188 218.535156 225.1875 218.46875 C 227.382812 218.46875 229.582031 217.933594 231.578125 216.804688 C 233.640625 215.671875 235.234375 214.074219 236.300781 212.144531 Z M 138.695312 162.777344 C 136.5 166.570312 136.300781 171.429688 138.695312 175.554688 L 149.808594 194.78125 L 160.917969 175.554688 C 163.246094 171.496094 163.113281 166.570312 160.917969 162.777344 C 159.855469 160.914062 158.257812 159.253906 156.195312 158.121094 C 154.199219 156.992188 152.003906 156.390625 149.808594 156.457031 C 147.613281 156.457031 145.417969 156.992188 143.421875 158.121094 C 141.359375 159.253906 139.761719 160.847656 138.695312 162.777344 Z";
const LOGO_BODY =
  "M 218.601562 191.71875 L 225.253906 180.210938 L 216.273438 164.640625 L 216.273438 164.574219 L 195.449219 128.582031 C 190.792969 120.53125 184.269531 113.8125 176.222656 109.152344 L 175.488281 108.753906 C 167.636719 104.363281 158.789062 102.167969 149.742188 102.167969 C 140.691406 102.167969 131.84375 104.363281 123.925781 108.753906 L 123.328125 109.085938 C 115.144531 113.8125 108.691406 120.53125 104.03125 128.582031 L 83.207031 164.574219 L 83.207031 164.640625 L 53.800781 215.605469 C 50.273438 221.726562 52.402344 229.511719 58.523438 233.039062 C 64.644531 236.5625 72.429688 234.433594 75.957031 228.3125 L 105.695312 176.816406 L 126.121094 141.421875 C 128.515625 137.230469 131.84375 133.703125 136.035156 131.308594 L 136.5 131.042969 C 140.492188 128.847656 145.082031 127.847656 149.675781 127.847656 C 154.332031 127.847656 158.855469 128.847656 162.914062 131.042969 L 163.3125 131.242188 C 167.570312 133.703125 170.898438 137.230469 173.292969 141.421875 L 193.71875 176.816406 L 213.8125 211.546875 C 211.949219 207.820312 211.882812 203.296875 214.144531 199.4375 Z M 156.394531 183.203125 L 160.851562 175.488281 C 163.113281 171.628906 163.046875 167.035156 161.183594 163.378906 L 181.277344 198.109375 L 201.703125 233.503906 C 204.097656 237.695312 207.425781 241.222656 211.683594 243.683594 L 212.082031 243.882812 C 216.140625 246.144531 220.664062 247.074219 225.320312 247.074219 C 229.980469 247.074219 234.503906 246.078125 238.496094 243.882812 L 238.960938 243.617188 C 243.152344 241.222656 246.480469 237.695312 248.875 233.503906 L 269.300781 198.109375 L 299.039062 146.613281 C 302.566406 140.492188 310.351562 138.359375 316.472656 141.886719 C 322.59375 145.414062 324.722656 153.199219 321.195312 159.320312 L 291.789062 210.285156 L 291.789062 210.351562 L 271.03125 246.34375 C 266.371094 254.394531 259.851562 261.113281 251.734375 265.839844 L 251.136719 266.171875 C 243.21875 270.628906 234.371094 272.757812 225.320312 272.757812 C 216.273438 272.757812 207.425781 270.5625 199.574219 266.171875 L 198.84375 265.773438 C 190.792969 261.113281 184.269531 254.394531 179.613281 246.34375 L 158.855469 210.351562 L 158.855469 210.285156 L 149.875 194.714844 Z M 319.398438 114.941406 C 319.398438 121.925781 325.054688 127.582031 332.039062 127.582031 C 339.027344 127.582031 344.683594 121.925781 344.683594 114.941406 C 344.683594 107.957031 339.027344 102.300781 332.039062 102.300781 C 325.054688 102.234375 319.398438 107.957031 319.398438 114.941406 Z M 55.597656 259.984375 C 55.597656 252.996094 49.941406 247.34375 42.957031 247.34375 C 35.96875 247.34375 30.316406 252.996094 30.316406 259.984375 C 30.316406 266.96875 35.96875 272.625 42.957031 272.625 C 49.941406 272.625 55.597656 266.96875 55.597656 259.984375 Z";
const LOGO_STROKES =
  "M 149.742188 194.714844 L 138.628906 175.488281 C 136.234375 171.429688 136.433594 166.503906 138.628906 162.710938 L 102.570312 225.121094 L 86.136719 253.730469 C 82.609375 259.851562 84.671875 267.699219 90.792969 271.226562 C 96.914062 274.753906 104.765625 272.691406 108.289062 266.570312 L 124.65625 238.292969 Z M 225.253906 180.210938 L 236.367188 199.4375 C 238.761719 203.496094 238.5625 208.421875 236.367188 212.210938 L 272.425781 149.804688 L 288.925781 121.261719 C 292.453125 115.140625 290.390625 107.289062 284.269531 103.765625 C 278.148438 100.238281 270.296875 102.300781 266.773438 108.421875 L 250.40625 136.699219 Z";

const LogoMark = ({ size, clipId }: { size: number; clipId: string }) => (
  <svg width={size} height={size} viewBox="0 0 375 375">
    <defs>
      <clipPath id={clipId}>
        <path d={LOGO_CLIP} />
      </clipPath>
    </defs>
    <path fill="#5b00ef" fillRule="evenodd" d={LOGO_DIAMONDS} />
    <g clipPath={`url(#${clipId})`}>
      <path fill="#e4f0ff" fillRule="evenodd" d={LOGO_BODY} />
    </g>
    <path fill="#803cee" fillRule="evenodd" d={LOGO_STROKES} />
  </svg>
);

export const makePanelOGImage = (): ImageResponse =>
  new ImageResponse(
    <div
      style={{
        background: "#040d1a",
        display: "flex",
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        height: "100%",
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          background:
            "radial-gradient(circle, rgba(91,0,239,0.14) 0%, transparent 65%)",
          borderRadius: "50%",
          display: "flex",
          height: 560,
          left: -60,
          position: "absolute",
          top: -120,
          width: 560,
        }}
      />

      <div
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)",
          borderRadius: "50%",
          bottom: -140,
          display: "flex",
          height: 500,
          position: "absolute",
          right: -60,
          width: 500,
        }}
      />

      <div
        style={{
          background:
            "linear-gradient(90deg, #5b00ef 0%, #803cee 50%, #3b82f6 100%)",
          display: "flex",
          height: 3,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        }}
      />

      <div
        style={{
          display: "flex",
          opacity: 0.055,
          position: "absolute",
          right: -80,
          top: 60,
        }}
      >
        <LogoMark size={500} clipId="og-lg-clip" />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          maxWidth: 740,
          padding: "56px 80px 50px",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 16,
            marginBottom: 46,
          }}
        >
          <LogoMark size={50} clipId="og-sm-clip" />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                color: "#e4f0ff",
                display: "flex",
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: 4,
                textTransform: "uppercase",
              }}
            >
              NodeByte Hosting
            </span>
            <span
              style={{
                color: "#2a4460",
                display: "flex",
                fontSize: 13,
                fontStyle: "italic",
                fontWeight: 400,
                letterSpacing: 0.2,
              }}
            >
              Game Server Management Panel
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
            marginBottom: 24,
          }}
        >
          <span
            style={{
              color: "#e4f0ff",
              display: "flex",
              fontSize: 80,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1,
            }}
          >
            Manage Your
          </span>
          <span
            style={{
              color: "#803cee",
              display: "flex",
              fontSize: 80,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1,
            }}
          >
            Game Servers.
          </span>
        </div>

        <div
          style={{
            color: "#4a6a8a",
            display: "flex",
            fontSize: 20,
            fontWeight: 400,
            lineHeight: 1.45,
            marginBottom: 44,
          }}
        >
          Deploy, monitor, and manage your game servers from one place. Invite
          team members, view performance, and stay in control.
        </div>

        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "nowrap",
          }}
        >
          {[
            "Instant Deploy",
            "Live Console",
            "Team Members",
            "Backups",
            "DDoS Protected",
          ].map((feat, i) => (
            <div key={feat} style={{ alignItems: "center", display: "flex" }}>
              {i > 0 && (
                <span
                  style={{
                    color: "#162840",
                    display: "flex",
                    fontSize: 16,
                    margin: "0 14px",
                  }}
                >
                  ·
                </span>
              )}
              <span
                style={{
                  color: "#3a5a78",
                  display: "flex",
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                {feat}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          bottom: 32,
          color: "rgba(58,90,120,0.38)",
          display: "flex",
          fontSize: 13,
          left: 80,
          letterSpacing: 1.5,
          position: "absolute",
        }}
      >
        panel.nodebyte.host
      </div>
    </div>,
    {
      height: OG_SIZE.height,
      width: OG_SIZE.width,
    }
  );
