import { useState } from 'react'
import {
  ConfigProvider,
  AdaptivityProvider,
  AppRoot,
  SplitLayout,
  SplitCol,
  View,
  Panel,
  Tabs,
  TabsItem,
} from '@vkontakte/vkui'
import { SearchPage } from './components/SearchPage'
import { SellerPage } from './components/SellerPage'
import { AdminPage } from './components/AdminPage'

type Tab = 'search' | 'seller' | 'admin'

// Корень «СтокПоиск» в VKUI: шапка + вкладки «Поиск / Мой сток / Админ».
export default function App() {
  const [tab, setTab] = useState<Tab>('search')

  return (
    <ConfigProvider>
      <AdaptivityProvider>
        <AppRoot>
          <SplitLayout>
            <SplitCol autoSpaced>
              <View activePanel="main">
                <Panel id="main">
                  <div style={{ maxWidth: 860, margin: '0 auto', width: '100%' }}>
                    <div style={{ padding: '16px 16px 4px', fontSize: 22, fontWeight: 700 }}>СтокПоиск</div>
                    <Tabs>
                    <TabsItem selected={tab === 'search'} onClick={() => setTab('search')}>
                      Поиск
                    </TabsItem>
                    <TabsItem selected={tab === 'seller'} onClick={() => setTab('seller')}>
                      Мой сток
                    </TabsItem>
                    <TabsItem selected={tab === 'admin'} onClick={() => setTab('admin')}>
                      Админ
                    </TabsItem>
                  </Tabs>
                  {tab === 'search' && <SearchPage />}
                  {tab === 'seller' && <SellerPage />}
                  {tab === 'admin' && <AdminPage />}
                  </div>
                </Panel>
              </View>
            </SplitCol>
          </SplitLayout>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  )
}
