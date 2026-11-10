import { Player, TileData } from "@/types/game.types";
import React from "react";
import DiceRoller3D from "./DiceRoller3D";
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
    <ToyButton color={color} disabled={disabled} onClick={onClick}>
      <span className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span>{label}</span>
      </span>
      <span
        className="rounded-full bg-white/90 px-2.5 py-0.5 text-sm"
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

        <div className="mt-4 space-y-3">
          {/* ===== MUA LẠI TỪ ĐỐI THỦ ===== */}
          {isOpponent && !currentTile.hasVilla && (
            <>
              <div
                className="rounded-xl px-3 py-2 text-left text-xs"
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
                price={200}
                color="blue"
                disabled={money < 200}
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

export const JailModal: React.FC<JailModalProps> = ({
  currPlayer,
  onPayBail,
  onRollComplete,
}) => {
  return (
    <ToyOverlay z={50}>
      <ToyPanel color="red" icon="🚔" title="Bạn Đang Ở Tù" maxWidth={400}>
        <div className="mt-2 flex justify-center">
          <span
            className="rounded-full px-3 py-1 text-sm"
            style={{
              background: TOY_COLORS.red.soft,
              color: TOY_COLORS.red.text,
            }}
          >
            Còn {currPlayer.jailTurns} lượt tù
          </span>
        </div>

        <div className="mt-4 space-y-3">
          <ToyButton
            color="green"
            size="lg"
            disabled={currPlayer.money < 200}
            onClick={onPayBail}
          >
            <span className="flex items-center gap-2">
              <span className="text-xl">🔓</span> Trả tiền ra tù
            </span>
            <span
              className="rounded-full bg-white/90 px-2.5 py-0.5 text-sm"
              style={{ color: TOY_COLORS.green.text, textShadow: "none" }}
            >
              $200
            </span>
          </ToyButton>

          <div
            className="flex items-center gap-2 text-xs"
            style={{ color: "#9aa0b5" }}
          >
            <span className="h-[3px] flex-1 rounded-full bg-[#f0e3cc]" />
            HOẶC
            <span className="h-[3px] flex-1 rounded-full bg-[#f0e3cc]" />
          </div>

          <p className="text-sm" style={{ color: "#5b6078" }}>
            🎲 Đổ được{" "}
            <b style={{ color: TOY_COLORS.orange.dark }}>xúc xắc đôi</b> để
            thoát tù!
          </p>
          <DiceRoller3D onRollComplete={onRollComplete} />
        </div>
      </ToyPanel>
    </ToyOverlay>
  );
};
