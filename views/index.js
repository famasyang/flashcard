// pages/index.js
import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '../styles/Home.module.css';
import Head from 'next/head';

export default function Home() {
  const [userCards, setUserCards] = useState([]);
  const [publicCards, setPublicCards] = useState([]);
  const [username, setUsername] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [role, setRole] = useState('');
  const [activeSection, setActiveSection] = useState('my-cards');
  const [leaderboard, setLeaderboard] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    // Fetch initial data for userCards, publicCards, username, inviteCode, and role
    fetch('/api/get-initial-data')
      .then((res) => res.json())
      .then((data) => {
        setUserCards(data.userCards);
        setPublicCards(data.publicCards);
        setUsername(data.username);
        setInviteCode(data.inviteCode);
        setRole(data.role);
      });
  }, []);

  const handleLogout = () => {
    fetch('/api/logout')
      .then(() => {
        window.location.href = '/login';
      })
      .catch((err) => console.error('Logout error:', err));
  };

  const loadLeaderboard = () => {
    fetch('/api/leaderboard')
      .then((res) => res.json())
      .then((data) => setLeaderboard(data))
      .catch((err) => console.error('Failed to load leaderboard:', err));
  };

  const startMemory = (cardName, mode) => {
    const url = mode === 'ordered' ? `/card/${cardName}` : `/card/${cardName}?random=true`;
    window.location.href = url;
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>学习卡片</title>
        <link rel="stylesheet" href="/style.css" />
        <link
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/css/all.min.css"
          rel="stylesheet"
        />
      </Head>

      <main className={styles.content}>
        <h1>记吧</h1>

        {activeSection === 'my-cards' && (
          <div className={styles.cardSection}>
            <h2>我的学习卡片</h2>
            <div className={styles.cardContainer}>
              {userCards.map((card) => (
                <div key={card.name} className={styles.mdCard}>
                  <Link href={`/card/${card.name}`} passHref>
                    <h2 className={styles.mdCardTitle}>{card.name}</h2>
                  </Link>
                  <div className={styles.cardButtons}>
                    <button
                      className={styles.memoryBtn}
                      onClick={() => startMemory(card.name, 'ordered')}
                    >
                      顺序记忆
                    </button>
                    <button
                      className={styles.memoryBtn}
                      onClick={() => startMemory(card.name, 'random')}
                    >
                      随机记忆
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'public-cards' && (
          <div className={styles.cardSection}>
            <h2>公共学习卡片</h2>
            <div className={styles.cardContainer}>
              {publicCards.map((card) => (
                <div key={card.name} className={styles.mdCard}>
                  <Link href={`/card/${card.name}`} passHref>
                    <h2 className={styles.mdCardTitle}>{card.name}</h2>
                  </Link>
                  <div className={styles.cardButtons}>
                    <button
                      className={styles.memoryBtn}
                      onClick={() => startMemory(card.name, 'ordered')}
                    >
                      顺序记忆
                    </button>
                    <button
                      className={styles.memoryBtn}
                      onClick={() => startMemory(card.name, 'random')}
                    >
                      随机记忆
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'profile' && (
          <div className={styles.cardSection}>
            <h2>个人资料</h2>
            <p>用户名: {username}</p>
            <p>邀请码: {inviteCode}</p>
            <button onClick={handleLogout} className={styles.logoutBtn}>
              退出
            </button>
            {role === 'admin' && (
              <Link href="/admin" passHref>
                <button className={styles.adminBtn}>管理员功能</button>
              </Link>
            )}
            <button
              onClick={() => setShowUploadModal(true)}
              className={styles.uploadBtn}
            >
              上传单词卡
            </button>
            <button
              onClick={() => {
                setShowLeaderboard(true);
                loadLeaderboard();
              }}
              className={styles.leaderboardBtn}
            >
              学习排行榜
            </button>
          </div>
        )}
      </main>

      <nav className={styles.bottomMenu}>
        <button
          className={`${styles.menuItem} ${
            activeSection === 'my-cards' ? styles.active : ''
          }`}
          onClick={() => setActiveSection('my-cards')}
        >
          <i className="fas fa-book"></i>
          <span>我的</span>
        </button>
        <button
          className={`${styles.menuItem} ${
            activeSection === 'public-cards' ? styles.active : ''
          }`}
          onClick={() => setActiveSection('public-cards')}
        >
          <i className="fas fa-globe"></i>
          <span>公共</span>
        </button>
        <button
          className={`${styles.menuItem} ${
            activeSection === 'profile' ? styles.active : ''
          }`}
          onClick={() => setActiveSection('profile')}
        >
          <i className="fas fa-user"></i>
          <span>我</span>
        </button>
      </nav>

      {showLeaderboard && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <span
              className={styles.close}
              onClick={() => setShowLeaderboard(false)}
            >
              &times;
            </span>
            <h2>学习排行榜</h2>
            <table className={styles.leaderboardTable}>
              <thead>
                <tr>
                  <th>用户名</th>
                  <th>学习的词汇数量</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((user) => (
                  <tr key={user.username}>
                    <td>{user.username}</td>
                    <td>{user.totalWords}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <span
              className={styles.close}
              onClick={() => setShowUploadModal(false)}
            >
              &times;
            </span>
            <h2>上传或手动输入学习卡片</h2>
            {/* 上传文件和手动输入的表单代码部分，这里可以使用FormData和相关的处理方式 */}
          </div>
        </div>
      )}
    </div>
  );
}