import { Player, TileData } from "@/types/game.types";
import React from "react";
import { useGame } from "../_context/GameContext";
import DiceRoller3D from "./DiceRoller3D";
import { useIsPhoneLandscape } from "./ui/useScreen";
import {
  TOY_COLORS,
  ToyButton,
  ToyColor,
  ToyOverlay,
  ToyPanel,
  ToyPrice,
} from "./ui/ToyUI";

interface BuyModalProps {
  currentTile: TileData;
  currPlayer: Player;
  onBuy: (level: "land" | "house1" | "house2" | "house3" | "villa") => void;
  onSkip: () => void;
  calculateTileRent?: (tile: TileData) => number;
}

/** 1 lựa chọn mua: biểu tượng + tên + giá, tự mờ khi không đủ tiền */
function BuyOption({
  icon,
  label,
  price,
  color,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  price: number;
  color: ToyColor;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <ToyButton
      color={color}
      disabled={disabled}
      onClick={onClick}
      // Điện thoại ngang: 2 cột -> chữ nhỏ hơn 1 chút để không xuống dòng
      className="[@media(max-height:500px)]:px-3 [@media(max-height:500px)]:text-sm"
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="shrink-0 text-xl [@media(max-height:500px)]:text-lg">
          {icon}
        </span>
        {/* Tên dài (vd. "Mua lại & xây Khách sạn") tự xuống dòng, không bị ô giá đè lên */}
        <span className="min-w-0 text-left leading-tight text-balance">
          {label}
        </span>
      </span>
      <span
        className="shrink-0 rounded-full bg-white/90 px-2.5 py-0.5 text-sm [@media(max-height:500px)]:px-2 [@media(max-height:500px)]:text-xs"
        style={{
          color: TOY_COLORS[disabled ? "gray" : color].text,
          textShadow: "none",
        }}
      >
        ${price.toLocaleString("vi-VN")}
      </span>
    </ToyButton>
  );
}

/** Các mức xây thêm khi mua lại đất của đối thủ */
const BUYOUT_UPGRADES = [
  { level: "house1", houses: 1, icon: "🏠", priceKey: "house1Price" },
  { level: "house2", houses: 2, icon: "🏘️", priceKey: "house2Price" },
  { level: "house3", houses: 3, icon: "🏙️", priceKey: "house3Price" },
] as const;

export const BuyModal: React.FC<BuyModalProps> = ({
  currentTile,
  currPlayer,
  onBuy,
  onSkip,
}) => {
  const isUnowned = currentTile.ownerId === undefined;
  const isMine = currentTile.ownerId === currPlayer.id;
  const isOpponent = !isUnowned && !isMine;

  // Lấy chi phí ban đầu người chơi B đã bỏ ra
  const getOpponentPropertyCost = () => {
    if (currentTile.houses === 0) return currentTile.landPrice;
    if (currentTile.houses === 1) return currentTile.house1Price;
    if (currentTile.houses === 2) return currentTile.house2Price;
    if (currentTile.houses === 3) return currentTile.house3Price;
    return currentTile.landPrice;
  };

  const buyoutCost = getOpponentPropertyCost();
  // Tổng chi phí nếu mua lại ô 3 nhà và nâng cấp thẳng lên Biệt thự
  const buyoutAndVillaCost = buyoutCost + currentTile.villaPrice;
  const money = currPlayer.money;

  const title = isUnowned
    ? "Mua Bất Động Sản"
    : isMine
      ? "Nâng Cấp Nhà"
      : "Mua Lại Đất";

  return (
    <ToyOverlay z={50}>
      <ToyPanel
        color={isOpponent ? "red" : "blue"}
        icon={currentTile.type === "STATION" ? "🚌" : isOpponent ? "💥" : "🏡"}
        title={title}
        maxWidth={400}
      >
        {/* Thẻ thông tin ô đất */}
        <div
          className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-2.5 text-left"
          style={{ border: "3px solid #f0e3cc", boxShadow: "0 4px 0 #e3d3b5" }}
        >
          <span
            className="h-12 w-3 shrink-0 rounded-full"
            style={{
              background: currentTile.color,
              boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.18)",
            }}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg">{currentTile.name}</span>
            <span
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "#7a7f95" }}
            >
              Tiền của bạn <ToyPrice amount={money} color="green" />
            </span>
          </span>
        </div>

        <div className="mt-4 space-y-3 [@media(max-height:500px)]:mt-3 [@media(max-height:500px)]:grid [@media(max-height:500px)]:grid-cols-2 [@media(max-height:500px)]:gap-2 [@media(max-height:500px)]:space-y-0">
          {/* ===== MUA LẠI TỪ ĐỐI THỦ ===== */}
          {isOpponent && !currentTile.hasVilla && (
            <>
              <div
                className="col-span-2 rounded-xl px-3 py-2 text-left text-xs"
                style={{
                  background: TOY_COLORS.gold.soft,
                  color: TOY_COLORS.gold.text,
                }}
              >
                Bạn đã trả tiền thuê. Có thể mua lại ô đất này từ đối thủ!
              </div>
              <BuyOption
                icon="💥"
                label={`Mua lại (${currentTile.houses} nhà)`}
                price={buyoutCost}
                color="red"
                disabled={money < buyoutCost}
                onClick={() => onBuy("land")}
              />
              {/* Mua lại rồi xây thêm nhà ngay (chỉ các mức cao hơn số nhà hiện có) */}
              {currentTile.type !== "STATION" &&
                BUYOUT_UPGRADES.filter(
                  (u) => u.houses > currentTile.houses,
                ).map((u) => {
                  // = trả đối thủ giá hiện tại + trả ngân hàng phần chênh lệch
                  const price = currentTile[u.priceKey];
                  return (
                    <BuyOption
                      key={u.level}
                      icon={u.icon}
                      label={`Mua lại + ${u.houses} Nhà`}
                      price={price}
                      color="green"
                      disabled={money < price}
                      onClick={() => onBuy(u.level)}
                    />
                  );
                })}
              {currentTile.houses === 3 && (
                <BuyOption
                  icon="🏨"
                  label="Mua lại & xây Khách sạn"
                  price={buyoutAndVillaCost}
                  color="purple"
                  disabled={money < buyoutAndVillaCost}
                  onClick={() => onBuy("villa")}
                />
              )}
            </>
          )}

          {/* ===== MUA MỚI / NÂNG CẤP NHÀ CỦA MÌNH ===== */}
          {!isOpponent &&
            (currentTile.type === "STATION" ? (
              <BuyOption
                icon="🚌"
                label="Mua Bến Xe"
                price={currentTile.landPrice}
                color="blue"
                disabled={money < currentTile.landPrice}
                onClick={() => onBuy("land")}
              />
            ) : (
              <>
                {isUnowned && (
                  <>
                    <BuyOption
                      icon="🚩"
                      label="Mua Đất"
                      price={currentTile.landPrice}
                      color="orange"
                      disabled={money < currentTile.landPrice}
                      onClick={() => onBuy("land")}
                    />
                    <BuyOption
                      icon="🏠"
                      label="Đất + 1 Nhà"
                      price={currentTile.house1Price}
                      color="green"
                      disabled={money < currentTile.house1Price}
                      onClick={() => onBuy("house1")}
                    />
                    <BuyOption
                      icon="🏘️"
                      label="Đất + 2 Nhà"
                      price={currentTile.house2Price}
                      color="green"
                      disabled={money < currentTile.house2Price}
                      onClick={() => onBuy("house2")}
                    />
                    <BuyOption
                      icon="🏙️"
                      label="Đất + 3 Nhà"
                      price={currentTile.house3Price}
                      color="green"
                      disabled={money < currentTile.house3Price}
                      onClick={() => onBuy("house3")}
                    />
                  </>
                )}

                {isMine && (
                  <>
                    {currentTile.houses === 0 && !currentTile.hasVilla && (
                      <BuyOption
                        icon="🏠"
                        label="Xây 1 Nhà"
                        price={currentTile.house1Price}
                        color="green"
                        disabled={money < currentTile.house1Price}
                        onClick={() => onBuy("house1")}
                      />
                    )}
                    {currentTile.houses === 1 && (
                      <BuyOption
                        icon="🏘️"
                        label="Nâng lên 2 Nhà"
                        price={
                          currentTile.house2Price - currentTile.house1Price
                        }
                        color="blue"
                        disabled={
                          money <
                          currentTile.house2Price - currentTile.house1Price
                        }
                        onClick={() => onBuy("house2")}
                      />
                    )}
                    {currentTile.houses === 2 && (
                      <BuyOption
                        icon="🏙️"
                        label="Nâng lên 3 Nhà"
                        price={
                          currentTile.house3Price - currentTile.house2Price
                        }
                        color="blue"
                        disabled={
                          money <
                          currentTile.house3Price - currentTile.house2Price
                        }
                        onClick={() => onBuy("house3")}
                      />
                    )}
                    {currentTile.houses === 3 && !currentTile.hasVilla && (
                      <BuyOption
                        icon="🏨"
                        label="Xây Khách sạn"
                        price={currentTile.villaPrice}
                        color="purple"
                        disabled={money < currentTile.villaPrice}
                        onClick={() => onBuy("villa")}
                      />
                    )}
                  </>
                )}
              </>
            ))}
        </div>

        <div className="mt-4">
          <ToyButton color="gray" onClick={onSkip}>
            <span
              className="mx-auto"
              style={{ color: "#3b4258", textShadow: "none" }}
            >
              Bỏ qua
            </span>
          </ToyButton>
        </div>
      </ToyPanel>
    </ToyOverlay>
  );
};

interface JailModalProps {
  currPlayer: Player;
  onPayBail: () => void;
  onRollComplete: (total: number, d1?: number, d2?: number) => void;
}

/** Số lượt tối đa phải ngồi tù (khớp với luật trong GameContext) */
const JAIL_MAX_TURNS = 2;

export const JailModal: React.FC<JailModalProps> = ({
  currPlayer,
  onPayBail,
  onRollComplete,
}) => {
  // Điện thoại xoay ngang: thu gọn để modal vừa 1 màn hình
  const isLandscape = useIsPhoneLandscape();
  const BAIL_COST = useGame().economy.jailBail;
  const canPay = currPlayer.money >= BAIL_COST;
  const totalPips = Math.max(JAIL_MAX_TURNS, currPlayer.jailTurns);

  // Lượt tù còn lại: chấm đỏ = lượt còn phải ngồi
  const turnsBadge = (
    <span
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-1.5 text-xs ${
        isLandscape ? "mt-2" : "mt-3 flex w-full"
      }`}
      style={{ background: TOY_COLORS.red.soft, color: TOY_COLORS.red.text }}
    >
      <span className="whitespace-nowrap">
        {isLandscape ? "Lượt tù" : "Lượt tù còn lại"}
      </span>
      <span className="flex gap-1">
        {Array.from({ length: totalPips }, (_, i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-full"
            style={{
              background:
                i < currPlayer.jailTurns ? TOY_COLORS.red.main : "#ffffff",
              border: `2px solid ${TOY_COLORS.red.main}`,
            }}
          />
        ))}
      </span>
      <b>{currPlayer.jailTurns}</b>
    </span>
  );

  return (
    <ToyOverlay z={50}>
      <ToyPanel
        color="red"
        icon="🚔"
        title="Bạn Đang Ở Tù"
        subtitle={
          isLandscape ? (
            <>
              <span className="block">Chọn 1 cách để thoát ra</span>
              {turnsBadge}
            </>
          ) : (
            "Chọn 1 cách để thoát ra"
          )
        }
        maxWidth={420}
      >
        {!isLandscape && turnsBadge}

        {/* Cách 1: nộp tiền bảo lãnh */}
        <div
          className={`flex items-center gap-3 rounded-2xl bg-white text-left ${
            isLandscape ? "p-2" : "mt-3 p-2.5"
          }`}
          style={{ border: "3px solid #f0e3cc", boxShadow: "0 4px 0 #e3d3b5" }}
        >
          <span
            className={`flex shrink-0 items-center justify-center rounded-full ${
              isLandscape ? "h-9 w-9 text-xl" : "h-11 w-11 text-2xl"
            }`}
            style={{
              background: TOY_COLORS.green.soft,
              boxShadow: `inset 0 -3px 0 ${TOY_COLORS.green.main}55`,
            }}
          >
            🔓
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span
              className="block text-sm"
              style={{ color: TOY_COLORS.green.dark }}
            >
              Nộp tiền bảo lãnh
            </span>
            <span className="block text-[11px]" style={{ color: "#7a7f95" }}>
              {canPay
                ? "Ra tù ngay & đổ xúc xắc đi tiếp"
                : `Bạn chỉ có $${currPlayer.money.toLocaleString("vi-VN")}`}
            </span>
          </span>
          <ToyButton
            color="green"
            size="sm"
            block={false}
            disabled={!canPay}
            onClick={onPayBail}
            className="shrink-0"
          >
            <span className="mx-auto whitespace-nowrap">
              {canPay
                ? `Trả $${BAIL_COST.toLocaleString("vi-VN")}`
                : "Không đủ tiền"}
            </span>
          </ToyButton>
        </div>

        <div
          className={`flex items-center gap-2 text-[11px] ${isLandscape ? "my-1.5" : "my-2"}`}
          style={{ color: "#9aa0b5" }}
        >
          <span className="h-[3px] flex-1 rounded-full bg-[#f0e3cc]" />
          HOẶC
          <span className="h-[3px] flex-1 rounded-full bg-[#f0e3cc]" />
        </div>

        {/* Cách 2: thử vận may với xúc xắc đôi */}
        <div
          className={`rounded-2xl ${isLandscape ? "p-2" : "p-3"}`}
          style={{
            background: `${TOY_COLORS.orange.soft}66`,
            border: `3px solid ${TOY_COLORS.orange.soft}`,
          }}
        >
          <p
            className={`leading-snug ${isLandscape ? "mb-1.5 text-[11px]" : "mb-2.5 text-xs"}`}
            style={{ color: "#5b6078" }}
          >
            🎲 Đổ được{" "}
            <b style={{ color: TOY_COLORS.orange.dark }}>xúc xắc đôi</b> để ra
            tù{isLandscape ? "" : " và đi luôn"}. Không được đôi thì mất lượt
            {currPlayer.jailTurns <= 1 ? " (lượt cuối, sau đó được thả)" : ""}.
          </p>
          <DiceRoller3D onRollComplete={onRollComplete} embedded />
        </div>
      </ToyPanel>
    </ToyOverlay>
  );
};
