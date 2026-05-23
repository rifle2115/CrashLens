"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";

function CustomTooltip({ active, payload, color, name }: TooltipProps<number, string> & { color: string; name: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(22,22,30,0.92)",
        border: `1px solid ${color}44`,
        borderRadius: 10,
        padding: "6px 12px",
        backdropFilter: "blur(12px)",
      }}
    >
      <span style={{ color, fontSize: 13, fontWeight: 700 }}>
        {payload[0].value?.toLocaleString()}
      </span>
      <span style={{ color: "#8b949e", fontSize: 11, marginLeft: 5 }}>{name}</span>
    </div>
  );
}

export interface MetricCardData {
  id: string;
  label: string;
  name: string;
  value: number;
  trend: number;
  tag: string;
  color: string;
  href: string;
  icon: React.ReactNode;
  series: { i: number; v: number }[];
}

export default function MetricCard({ data, index }: { data: MetricCardData; index: number }) {
  const gid = useId().replace(/:/g, "");
  const up = data.trend >= 0;
  const baseline =
    data.series.reduce((a, p) => a + p.v, 0) / Math.max(data.series.length, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: "easeOut" }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/60 p-5 backdrop-blur-xl"
    >
      <div
        className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full opacity-30 blur-2xl"
        style={{ background: data.color }}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: `linear-gradient(135deg, ${data.color}, ${data.color}99)` }}
          >
            {data.icon}
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted">{data.label}</p>
            <p className="text-[13.5px] font-semibold text-foreground">{data.name}</p>
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <p className="text-[10.5px] font-medium uppercase tracking-wide text-muted">
          Total {data.name}
        </p>
        <div className="mt-1 flex items-end gap-2.5">
          <span className="text-[32px] font-bold leading-none tracking-tight text-foreground">
            {data.value.toLocaleString()}
          </span>
          <span
            className="mb-0.5 flex items-center gap-1 text-[12px] font-semibold"
            style={{ color: up ? "#3fb950" : "#f85149" }}
          >
            {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {up ? "+" : ""}
            {data.trend}%
          </span>
        </div>
      </div>

      <div
        className="relative mt-3 min-h-[80px] flex-1"
        style={{ filter: `drop-shadow(0 2px 7px ${data.color}66)` }}
      >
        <span
          className="absolute right-0 top-0 z-10 rounded-md px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: `${data.color}26`, color: data.color }}
        >
          {data.tag}
        </span>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.series} margin={{ top: 28, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={data.color} stopOpacity={0.38} />
                <stop offset="100%" stopColor={data.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="i" hide />
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <ReferenceLine y={baseline} stroke="rgba(255,255,255,0.16)" strokeDasharray="4 4" />
            <Tooltip
              content={<CustomTooltip color={data.color} name={data.name} />}
              cursor={{ stroke: `${data.color}55`, strokeWidth: 1, strokeDasharray: "4 4" }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={data.color}
              strokeWidth={2.4}
              fill={`url(#fill-${gid})`}
              dot={false}
              activeDot={{ r: 4, fill: data.color, stroke: "#0d1117", strokeWidth: 2 }}
              isAnimationActive
              animationDuration={950}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
