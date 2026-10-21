# 事事顺每日同步配置（由 sync.sh source）
# 改成你自己的邮箱：只同步这个邮箱的提交。不要留示例地址。
SHISHISUN_EMAIL="you@example.com"
SHISHISUN_JOURNAL="${DSH_SHISHISUN_HOME:-$HOME/.dsh/shishisun}/commits"
SHISHISUN_MAX_COMMITS=300
# 相邻提交间隔超过多少分钟就不再累加工时（休息/会议空档）
SHISHISUN_GAP_MINUTES=45
# 当天第一轮的工时从几点起算
SHISHISUN_WORK_START="09:00"
# 午休时段不计入工时；留空则关闭
SHISHISUN_LUNCH_START="11:30"
SHISHISUN_LUNCH_END="13:30"

# 仓库名 -> 事事顺项目名；归属判定时优先级最高。返回空表示不限定。
shishisun_repo_project() {
  case "$1" in
    # sc-rcs-web) echo "天空地水工智能监测感知平台" ;;
    # oaWeb)      echo "融合通信" ;;
    *) echo "" ;;
  esac
}
